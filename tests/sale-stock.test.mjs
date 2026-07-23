// Migration 0076: a sale deducts kit stock and cannot oversell.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

async function kitWithStock(db, qty) {
  const kit = (await db.query(
    `insert into products (item_code, name, product_type) values ($1,'Test Kit','kit') returning id`,
    [`KIT-${Math.random().toString(16).slice(2, 8)}`],
  )).rows[0].id;
  await db.query(
    `insert into kit_batches (batch_no, product_id, qty_received, qty_available, buy_price) values ($1,$2,$3,$3,10)`,
    [`B-${Math.random().toString(16).slice(2, 8)}`, kit, qty],
  );
  return kit;
}
const line = (pid, qty, sell = 50) => JSON.stringify([{ product_id: pid, qty, sell_price: sell }]);

test("selling a kit deducts batch stock", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  const kit = await kitWithStock(db, 10);

  await db.query(`select fn_pos_checkout($1,$2,$3)`, [randomUUID(), labId, line(kit, 3)]);
  const avail = await db.query(`select coalesce(sum(qty_available),0)::numeric n from kit_batches where product_id=$1`, [kit]);
  assert.equal(Number(avail.rows[0].n), 7, "stock should drop from 10 to 7");
  await db.close();
});

test("overselling a kit is rejected and books nothing", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  const kit = await kitWithStock(db, 2);

  await assert.rejects(
    () => db.query(`select fn_pos_checkout($1,$2,$3)`, [randomUUID(), labId, line(kit, 5)]),
    /insufficient stock/i,
  );
  // The whole checkout rolled back: no sale, stock untouched.
  const sales = await db.query(`select count(*)::int n from sales where product_id=$1`, [kit]);
  const avail = await db.query(`select coalesce(sum(qty_available),0)::numeric n from kit_batches where product_id=$1`, [kit]);
  assert.equal(sales.rows[0].n, 0, "no sale booked");
  assert.equal(Number(avail.rows[0].n), 2, "stock unchanged");
  await db.close();
});

test("spare parts and devices sell without a stock check", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db); // spare_part
  const res = await db.query(`select n_lines from fn_pos_checkout($1,$2,$3)`, [randomUUID(), labId, line(productId, 999)]);
  assert.equal(Number(res.rows[0].n_lines), 1, "untracked product sells freely");
  await db.close();
});

test("a replayed checkout does not deduct stock twice (idempotent)", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  const kit = await kitWithStock(db, 10);
  const req = randomUUID();

  await db.query(`select fn_pos_checkout($1,$2,$3)`, [req, labId, line(kit, 4)]);
  // Replay the same request id twice.
  await db.query(`select fn_pos_checkout($1,$2,$3)`, [req, labId, line(kit, 4)]);
  await db.query(`select fn_pos_checkout($1,$2,$3)`, [req, labId, line(kit, 4)]);
  const avail = await db.query(`select coalesce(sum(qty_available),0)::numeric n from kit_batches where product_id=$1`, [kit]);
  assert.equal(Number(avail.rows[0].n), 6, "deducted once (10 - 4), not per replay");
  await db.close();
});
