// Migration 0077: sales and purchases post balanced double-entry journal entries.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

test("a sale posts a balanced journal entry (Dr AR/COGS, Cr Sales/Stock)", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);

  // qty 2 @ sell 50 (revenue 100), buy 10 (cost 20)
  await db.query(
    `insert into sales (lab_id, product_id, qty, buy_price, sell_price) values ($1,$2,2,10,50)`,
    [labId, productId],
  );

  const je = await db.query(
    `select id, status, total_debit, total_credit from journal_entries where voucher_type='Sales Invoice' order by created_at desc limit 1`,
  );
  assert.equal(je.rows.length, 1, "a journal entry was created");
  assert.equal(je.rows[0].status, "posted", "it is posted");
  assert.equal(Number(je.rows[0].total_debit), Number(je.rows[0].total_credit), "balanced");
  assert.equal(Number(je.rows[0].total_debit), 120, "revenue 100 + cost 20 = 120 on each side");

  const lines = await db.query(
    `select l.account, l.debit, l.credit from journal_entry_accounts l
      where l.journal_entry_id = $1 order by l.debit desc, l.credit desc`,
    [je.rows[0].id],
  );
  const byAcct = Object.fromEntries(lines.rows.map((r) => [r.account, `${Number(r.debit)}/${Number(r.credit)}`]));
  assert.equal(byAcct["Accounts Receivable"], "100/0");
  assert.equal(byAcct["Sales"], "0/100");
  assert.equal(byAcct["Cost of Goods Sold"], "20/0");
  assert.equal(byAcct["Stock In Hand"], "0/20");
  await db.close();
});

test("a purchase invoice posts Dr Stock / Cr Payable, once", async () => {
  const db = await bootWithMigrations();
  const pi = (await db.query(
    `insert into purchase_invoices (posting_date, total_amount) values (current_date, 500) returning id`,
  )).rows[0].id;

  const je = await db.query(`select id, status, total_debit from journal_entries where voucher_type='Purchase Invoice'`);
  assert.equal(je.rows.length, 1);
  assert.equal(je.rows[0].status, "posted");
  assert.equal(Number(je.rows[0].total_debit), 500);

  // A further update must not double-post.
  await db.query(`update purchase_invoices set notes='x' where id=$1`, [pi]);
  const count = await db.query(`select count(*)::int n from journal_entries where voucher_type='Purchase Invoice'`);
  assert.equal(count.rows[0].n, 1, "posted exactly once");
  const posted = await db.query(`select gl_posted_at from purchase_invoices where id=$1`, [pi]);
  assert.ok(posted.rows[0].gl_posted_at, "gl_posted_at is stamped");
  await db.close();
});

test("a GL failure never blocks the sale", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);
  // Remove the receivable account so GL posting can't fully balance the revenue
  // leg — the sale must still be recorded.
  await db.query(`delete from journal_entry_accounts`);
  await db.query(`update accounts set disabled = true where account_type = 'Receivable'`);
  await db.query(
    `insert into sales (lab_id, product_id, qty, buy_price, sell_price) values ($1,$2,1,10,50)`,
    [labId, productId],
  );
  const sales = await db.query(`select count(*)::int n from sales where lab_id=$1`, [labId]);
  assert.equal(sales.rows[0].n, 1, "sale booked despite GL account being unavailable");
  await db.close();
});
