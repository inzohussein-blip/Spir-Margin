// Migration 0075: editing or deleting a sales/purchase order must be captured
// by the immutable audit trail (so it shows in Monitoring → Change & Deletion Log).
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

test("editing and deleting a sales order is recorded in the audit log", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);

  const so = (await db.query(`insert into sales_orders (lab_id, notes) values ($1,'first') returning id`, [labId])).rows[0].id;
  await db.query(`insert into sales_order_items (sales_order_id, product_id, qty, rate) values ($1,$2,2,10)`, [so, productId]);

  // Edit the header and replace a line.
  await db.query(`update sales_orders set notes='edited' where id=$1`, [so]);
  await db.query(`delete from sales_order_items where sales_order_id=$1`, [so]);
  // Delete the order.
  await db.query(`delete from sales_orders where id=$1`, [so]);

  const upd = await db.query(`select count(*)::int n from audit_log where table_name='sales_orders' and action='UPDATE' and record_id=$1`, [so]);
  const del = await db.query(`select count(*)::int n from audit_log where table_name='sales_orders' and action='DELETE' and record_id=$1`, [so]);
  const itemDel = await db.query(`select count(*)::int n from audit_log where table_name='sales_order_items' and action='DELETE'`);
  assert.ok(upd.rows[0].n >= 1, "header edit recorded");
  assert.equal(del.rows[0].n, 1, "order deletion recorded");
  assert.ok(itemDel.rows[0].n >= 1, "line-item deletion recorded");
  await db.close();
});

test("editing and deleting a purchase order is recorded in the audit log", async () => {
  const db = await bootWithMigrations();
  const { productId } = await ensureLabAndProduct(db);

  const po = (await db.query(`insert into purchase_orders (po_no, notes) values ('PO-AUD','first') returning id`)).rows[0].id;
  await db.query(`insert into purchase_order_items (po_id, product_id, qty, rate) values ($1,$2,3,5)`, [po, productId]);

  await db.query(`update purchase_orders set notes='edited' where id=$1`, [po]);
  await db.query(`delete from purchase_orders where id=$1`, [po]);

  const upd = await db.query(`select count(*)::int n from audit_log where table_name='purchase_orders' and action='UPDATE' and record_id=$1`, [po]);
  const del = await db.query(`select count(*)::int n from audit_log where table_name='purchase_orders' and action='DELETE' and record_id=$1`, [po]);
  assert.ok(upd.rows[0].n >= 1, "PO edit recorded");
  assert.equal(del.rows[0].n, 1, "PO deletion recorded");
  await db.close();
});
