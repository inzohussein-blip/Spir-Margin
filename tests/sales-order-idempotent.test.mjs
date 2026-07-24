// Migration 0078: offline sales-order creation must be idempotent on replay.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

const lines = (pid) => JSON.stringify([{ product_id: pid, qty: 2, rate: 25, serial_no: "SN-1" }]);

test("fn_save_sales_order books header + lines and is idempotent on the request id", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);
  const req = randomUUID();

  const r1 = await db.query(`select fn_save_sales_order($1,$2,$3,$4,$5,$6) as id`,
    [req, labId, "2026-01-01", "", "first", lines(productId)]);
  const id1 = r1.rows[0].id;
  assert.ok(id1);
  const items = await db.query(`select count(*)::int n from sales_order_items where sales_order_id=$1`, [id1]);
  assert.equal(items.rows[0].n, 1);

  // Replay the same request id twice — same order, no duplicates.
  for (let i = 0; i < 2; i++) {
    const again = await db.query(`select fn_save_sales_order($1,$2,$3,$4,$5,$6) as id`,
      [req, labId, "2026-01-01", "", "first", lines(productId)]);
    assert.equal(again.rows[0].id, id1, "same order id returned");
  }
  const orders = await db.query(`select count(*)::int n from sales_orders where lab_id=$1`, [labId]);
  assert.equal(orders.rows[0].n, 1, "exactly one order");
  const lineCount = await db.query(`select count(*)::int n from sales_order_items where sales_order_id=$1`, [id1]);
  assert.equal(lineCount.rows[0].n, 1, "lines not duplicated");

  // A different request id makes a new order.
  await db.query(`select fn_save_sales_order($1,$2,$3,$4,$5,$6)`,
    [randomUUID(), labId, "", "", "second", lines(productId)]);
  const after = await db.query(`select count(*)::int n from sales_orders where lab_id=$1`, [labId]);
  assert.equal(after.rows[0].n, 2);
  await db.close();
});

test("fn_save_sales_order rejects an order with no valid lines", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  await assert.rejects(
    () => db.query(`select fn_save_sales_order($1,$2,$3,$4,$5,$6)`, [randomUUID(), labId, "", "", "", "[]"]),
    /at least one line/i,
  );
  await db.close();
});
