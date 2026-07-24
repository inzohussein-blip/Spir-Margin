// Migration 0079: editing or deleting a sales invoice's LINE items, a
// recorded payment, or a quotation must be captured by the immutable audit
// trail (so it shows in Monitoring → Change & Deletion Log). Before 0079 the
// invoice header was audited but its lines were not — a billed qty/rate could
// be altered with no trace.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

test("editing a sales-invoice line item is recorded in the audit log", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);

  const inv = (await db.query(
    `insert into sales_invoices (invoice_no, lab_id) values ('INV-AUD',$1) returning id`, [labId]
  )).rows[0].id;
  const line = (await db.query(
    `insert into sales_invoice_items (invoice_id, product_id, qty, rate) values ($1,$2,2,10) returning id`,
    [inv, productId]
  )).rows[0].id;

  // Tamper with the billed rate, then delete the line.
  await db.query(`update sales_invoice_items set rate=999 where id=$1`, [line]);
  await db.query(`delete from sales_invoice_items where id=$1`, [line]);

  const upd = await db.query(
    `select changed_fields from audit_log where table_name='sales_invoice_items' and action='UPDATE' and record_id=$1`, [line]
  );
  const del = await db.query(
    `select count(*)::int n from audit_log where table_name='sales_invoice_items' and action='DELETE' and record_id=$1`, [line]
  );
  assert.ok(upd.rows.length >= 1, "line edit recorded");
  assert.ok(upd.rows[0].changed_fields.includes("rate"), "the changed rate is captured");
  assert.equal(del.rows[0].n, 1, "line deletion recorded");
  await db.close();
});

test("recorded invoice payments and quotations are audited", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);

  // A recorded payment leaves a trace.
  const inv = (await db.query(
    `insert into sales_invoices (invoice_no, lab_id) values ('INV-PAY',$1) returning id`, [labId]
  )).rows[0].id;
  await db.query(
    `insert into sales_invoice_payments (invoice_id, amount) values ($1, 50)`, [inv]
  );
  const pay = await db.query(
    `select count(*)::int n from audit_log where table_name='sales_invoice_payments' and action='INSERT'`
  );
  assert.ok(pay.rows[0].n >= 1, "payment insert recorded");

  // Editing a quotation leaves a trace.
  const q = (await db.query(
    `insert into quotations (lab_id, notes) values ($1,'draft') returning id`, [labId]
  )).rows[0].id;
  await db.query(`update quotations set notes='revised' where id=$1`, [q]);
  const qa = await db.query(
    `select count(*)::int n from audit_log where table_name='quotations' and action='UPDATE' and record_id=$1`, [q]
  );
  assert.ok(qa.rows[0].n >= 1, "quotation edit recorded");
  await db.close();
});
