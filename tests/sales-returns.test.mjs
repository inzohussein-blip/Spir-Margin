// Migration 0080: a sales return (credit note) mirrors a sale — it restocks
// kits, posts a reversing journal entry, is idempotent on replay, and nets out
// of the profit summary. Money-critical, so every leg is pinned here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

async function kit(db, buy = 10, sell = 50) {
  const id = (await db.query(
    `insert into products (item_code, name, product_type, default_buy_price, default_sell_price)
     values ($1,'Kit','kit',$2,$3) returning id`,
    [`KIT-${Math.random().toString(16).slice(2, 8)}`, buy, sell],
  )).rows[0].id;
  return id;
}
const lines = (pid, qty, sell = 50) => JSON.stringify([{ product_id: pid, qty, sell_price: sell }]);

test("booking a return restocks kit stock and is idempotent on the request id", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  const k = await kit(db);
  const req = randomUUID();

  const id1 = (await db.query(`select fn_book_sales_return($1,$2,$3,$4,$5,$6) as id`,
    [req, labId, "2026-02-01", "damaged", "", lines(k, 3)])).rows[0].id;
  assert.ok(id1);

  // Stock put back: exactly 3 in a returned-goods batch.
  let avail = (await db.query(`select coalesce(sum(qty_available),0)::numeric n from kit_batches where product_id=$1`, [k])).rows[0].n;
  assert.equal(Number(avail), 3, "returned qty added to stock");

  // Replay twice — same return, no extra restock.
  for (let i = 0; i < 2; i++) {
    const again = (await db.query(`select fn_book_sales_return($1,$2,$3,$4,$5,$6) as id`,
      [req, labId, "2026-02-01", "damaged", "", lines(k, 3)])).rows[0].id;
    assert.equal(again, id1, "same return id");
  }
  avail = (await db.query(`select coalesce(sum(qty_available),0)::numeric n from kit_batches where product_id=$1`, [k])).rows[0].n;
  assert.equal(Number(avail), 3, "restock happened once, not per replay");
  const nRet = (await db.query(`select count(*)::int n from sales_returns where lab_id=$1`, [labId])).rows[0].n;
  assert.equal(nRet, 1, "exactly one return");
  await db.close();
});

test("a return posts a balanced reversing journal entry", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  const k = await kit(db, 10, 50); // buy 10, sell 50

  await db.query(`select fn_book_sales_return($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), labId, "", "", "", lines(k, 2, 50)]); // rev 100, cost 20

  const je = (await db.query(
    `select id, status, total_debit, total_credit from journal_entries
      where user_remark like '%sales return%' order by created_at desc limit 1`)).rows[0];
  assert.ok(je, "a journal entry was posted for the return");
  assert.equal(je.status, "posted");
  assert.equal(Number(je.total_debit), Number(je.total_credit), "balanced");
  assert.equal(Number(je.total_debit), 120, "revenue 100 + cost 20 = 120 each side");

  const rows = (await db.query(`select account, debit, credit from journal_entry_accounts where journal_entry_id=$1`, [je.id])).rows;
  const by = Object.fromEntries(rows.map((r) => [r.account, `${Number(r.debit)}/${Number(r.credit)}`]));
  // Reversed vs a sale: Sales is debited, Receivable credited; Stock debited, COGS credited.
  assert.equal(by["Sales"], "100/0", "revenue reversed out of Sales");
  assert.equal(by["Accounts Receivable"], "0/100", "receivable reduced");
  assert.equal(by["Stock In Hand"], "20/0", "cost returned to stock");
  assert.equal(by["Cost of Goods Sold"], "0/20", "COGS reduced");
  await db.close();
});

test("the profit summary is reported net of submitted returns", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  const k = await kit(db, 10, 50);

  // Sell 2 (rev 100, cost 20, profit 80).
  await db.query(`insert into sales (lab_id, product_id, qty, buy_price, sell_price) values ($1,$2,2,10,50)`, [labId, k]);
  let s = (await db.query(`select total_revenue, total_cost, total_profit, sales_count from v_profit_summary`)).rows[0];
  assert.equal(Number(s.total_revenue), 100);
  assert.equal(Number(s.total_profit), 80);

  // Return 1 (rev 50, cost 10, profit 40 reversed).
  await db.query(`select fn_book_sales_return($1,$2,$3,$4,$5,$6)`, [randomUUID(), labId, "", "", "", lines(k, 1, 50)]);
  s = (await db.query(`select total_revenue, total_cost, total_profit, sales_count from v_profit_summary`)).rows[0];
  assert.equal(Number(s.total_revenue), 50, "revenue net of the return (100-50)");
  assert.equal(Number(s.total_cost), 10, "cost net of the return (20-10)");
  assert.equal(Number(s.total_profit), 40, "profit net of the return (80-40)");
  assert.equal(Number(s.sales_count), 1, "sales_count counts sales only");
  await db.close();
});

test("a return with no valid lines is rejected", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  await assert.rejects(
    () => db.query(`select fn_book_sales_return($1,$2,$3,$4,$5,$6)`, [randomUUID(), labId, "", "", "", "[]"]),
    /at least one line/i,
  );
  await db.close();
});
