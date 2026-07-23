// Landed cost allocation (migration 0068). Cost accuracy is money-critical —
// a wrong allocation quietly distorts every margin on the received stock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

async function receiptWithTwoKits(db) {
  const sup = (await db.query(`insert into companies (name,role) values ('S','supplier') returning id`)).rows[0].id;
  const wh = (await db.query(`insert into warehouses (name) values ('W') returning id`)).rows[0].id;
  const k1 = (await db.query(`insert into products (item_code,name,product_type) values ('K1','K1','kit') returning id`)).rows[0].id;
  const k2 = (await db.query(`insert into products (item_code,name,product_type) values ('K2','K2','kit') returning id`)).rows[0].id;
  const r = (await db.query(`insert into purchase_receipts (receipt_no,supplier_id,status) values ('PR-T',$1,'draft') returning id`, [sup])).rows[0].id;
  await db.query(`insert into purchase_receipt_items (receipt_id,product_id,qty,rate,warehouse_id,batch_no)
    values ($1,$2,10,100,$3,'BK1'),($1,$4,10,200,$3,'BK2')`, [r, k1, wh, k2]);
  await db.query(`select fn_submit_purchase_receipt($1)`, [r]);
  return { r };
}

test("by-value allocation raises each batch's unit cost by its value share", async () => {
  const db = await bootWithMigrations();
  const { r } = await receiptWithTwoKits(db); // values 1000 and 2000 (total 3000)
  const v = (await db.query(`insert into landed_cost_vouchers (voucher_no,receipt_id,freight,allocation_method)
    values ('LC1',$1,300,'by_value') returning id`, [r])).rows[0].id;
  const total = (await db.query(`select fn_apply_landed_cost($1) t`, [v])).rows[0].t;
  assert.equal(Number(total), 300);
  const b = (await db.query(`select batch_no, buy_price from kit_batches order by batch_no`)).rows;
  assert.equal(Number(b[0].buy_price), 110); // 100 + 300*(1000/3000)/10
  assert.equal(Number(b[1].buy_price), 220); // 200 + 300*(2000/3000)/10
  await db.close();
});

test("by-qty allocation splits the extra cost evenly per unit", async () => {
  const db = await bootWithMigrations();
  const { r } = await receiptWithTwoKits(db); // qty 10 and 10 (total 20)
  const v = (await db.query(`insert into landed_cost_vouchers (voucher_no,receipt_id,customs,allocation_method)
    values ('LC2',$1,200,'by_qty') returning id`, [r])).rows[0].id;
  await db.query(`select fn_apply_landed_cost($1)`, [v]);
  const b = (await db.query(`select buy_price from kit_batches order by batch_no`)).rows;
  // 200 split 100/100 by qty, /10 units = +10 each
  assert.equal(Number(b[0].buy_price), 110);
  assert.equal(Number(b[1].buy_price), 210);
  await db.close();
});

test("a voucher cannot be applied twice", async () => {
  const db = await bootWithMigrations();
  const { r } = await receiptWithTwoKits(db);
  const v = (await db.query(`insert into landed_cost_vouchers (voucher_no,receipt_id,freight) values ('LC3',$1,100) returning id`, [r])).rows[0].id;
  await db.query(`select fn_apply_landed_cost($1)`, [v]);
  await assert.rejects(db.query(`select fn_apply_landed_cost($1)`, [v]), /already applied/i);
  await db.close();
});

test("a voucher on a not-yet-received receipt is rejected", async () => {
  const db = await bootWithMigrations();
  const sup = (await db.query(`insert into companies (name,role) values ('S','supplier') returning id`)).rows[0].id;
  const r = (await db.query(`insert into purchase_receipts (receipt_no,supplier_id,status) values ('PR-D',$1,'draft') returning id`, [sup])).rows[0].id;
  const v = (await db.query(`insert into landed_cost_vouchers (voucher_no,receipt_id,freight) values ('LC4',$1,50) returning id`, [r])).rows[0].id;
  await assert.rejects(db.query(`select fn_apply_landed_cost($1)`, [v]), /must be received/i);
  await db.close();
});
