// Reordering rules (migration 0066). Auto-replenishment must never
// double-order, or a warehouse drowns in duplicate POs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

async function setup(db) {
  const sup = (await db.query(`insert into companies (name, role) values ('Sup','supplier') returning id`)).rows[0].id;
  const p = (await db.query(
    `insert into products (item_code,name,product_type,supplier_id,default_buy_price,reorder_level)
     values ('RP','Reagent','kit',$1,50,100) returning id`, [sup])).rows[0].id;
  return { sup, p };
}

test("a product below its reorder level appears as a suggestion with the right shortfall", async () => {
  const db = await bootWithMigrations();
  const { p } = await setup(db); // reorder_level 100, no stock -> shortfall 100
  const rows = (await db.query(`select product_id, on_hand, shortfall from v_reorder_suggestions where product_id=$1`, [p])).rows;
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].on_hand), 0);
  assert.equal(Number(rows[0].shortfall), 100);
  await db.close();
});

test("a product at or above its reorder level is not suggested", async () => {
  const db = await bootWithMigrations();
  const { sup, p } = await setup(db);
  const wh = (await db.query(`insert into warehouses (name) values ('W') returning id`)).rows[0].id;
  await db.query(
    `insert into kit_batches (batch_no,product_id,warehouse_id,supplier_id,qty_received,qty_available,buy_price,sell_price)
     values ('B1',$1,$2,$3,100,120,50,80)`, [p, wh, sup]);
  const rows = (await db.query(`select 1 from v_reorder_suggestions where product_id=$1`, [p])).rows;
  assert.equal(rows.length, 0, "120 on hand >= 100 reorder level");
  await db.close();
});

test("generating creates one draft PO per supplier and is idempotent", async () => {
  const db = await bootWithMigrations();
  await setup(db);
  const first = (await db.query(`select fn_generate_reorder_pos() n`)).rows[0].n;
  assert.equal(Number(first), 1);
  const second = (await db.query(`select fn_generate_reorder_pos() n`)).rows[0].n;
  assert.equal(Number(second), 0, "already-ordered products must not be re-ordered");
  const po = (await db.query(`select status, total_amount from purchase_orders where po_no like 'PO-RE-%'`)).rows[0];
  assert.equal(po.status, "draft");
  assert.equal(Number(po.total_amount), 100 * 50); // shortfall 100 * buy 50
  await db.close();
});
