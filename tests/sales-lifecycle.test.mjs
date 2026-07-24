// End-to-end money path: a sales order delivered into stock-consuming sales,
// and the sales-invoice payment lifecycle. These functions move revenue,
// stock and receivables, so their guards are pinned here against regression.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

async function kitWithStock(db, qty, buy = 10) {
  const kit = (await db.query(
    `insert into products (item_code, name, product_type, default_buy_price)
     values ($1,'Test Kit','kit',$2) returning id`,
    [`KIT-${Math.random().toString(16).slice(2, 8)}`, buy],
  )).rows[0].id;
  await db.query(
    `insert into kit_batches (batch_no, product_id, qty_received, qty_available, buy_price)
     values ($1,$2,$3,$3,$4)`,
    [`B-${Math.random().toString(16).slice(2, 8)}`, kit, qty, buy],
  );
  return kit;
}

// --- Deliver a sales order -------------------------------------------------

test("delivering a sales order consumes stock, books a sale, and marks it delivered", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  const kit = await kitWithStock(db, 10, 40);

  const so = (await db.query(`insert into sales_orders (lab_id) values ($1) returning id`, [labId])).rows[0].id;
  await db.query(`insert into sales_order_items (sales_order_id, product_id, qty, rate) values ($1,$2,3,100)`, [so, kit]);

  const n = (await db.query(`select fn_deliver_sales_order($1) as n`, [so])).rows[0].n;
  assert.equal(Number(n), 1, "one line delivered");

  // Stock dropped 10 -> 7.
  const avail = (await db.query(`select coalesce(sum(qty_available),0)::numeric n from kit_batches where product_id=$1`, [kit])).rows[0].n;
  assert.equal(Number(avail), 7, "kit stock consumed");

  // A sale was booked with the order's rate as sell and the product buy price.
  const sale = (await db.query(`select qty, buy_price, sell_price, profit from sales where product_id=$1`, [kit])).rows[0];
  assert.equal(Number(sale.qty), 3);
  assert.equal(Number(sale.sell_price), 100);
  assert.equal(Number(sale.buy_price), 40);
  assert.equal(Number(sale.profit), (100 - 40) * 3, "profit = (sell-buy)*qty");

  // Order is now delivered.
  const st = (await db.query(`select status from sales_orders where id=$1`, [so])).rows[0].status;
  assert.equal(st, "delivered");
  await db.close();
});

test("a delivered or cancelled sales order cannot be delivered again", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  const kit = await kitWithStock(db, 10);

  const so = (await db.query(`insert into sales_orders (lab_id) values ($1) returning id`, [labId])).rows[0].id;
  await db.query(`insert into sales_order_items (sales_order_id, product_id, qty, rate) values ($1,$2,2,50)`, [so, kit]);
  await db.query(`select fn_deliver_sales_order($1)`, [so]);

  // Re-delivering is rejected — so stock is never double-consumed.
  await assert.rejects(() => db.query(`select fn_deliver_sales_order($1)`, [so]), /already delivered/i);
  const avail = (await db.query(`select coalesce(sum(qty_available),0)::numeric n from kit_batches where product_id=$1`, [kit])).rows[0].n;
  assert.equal(Number(avail), 8, "stock consumed exactly once (10 - 2)");
  await db.close();
});

// --- Sales-invoice payment lifecycle ---------------------------------------

async function draftInvoice(db, labId, productId, qty, rate) {
  const inv = (await db.query(
    `insert into sales_invoices (invoice_no, lab_id) values ($1,$2) returning id`,
    [`INV-${Math.random().toString(16).slice(2, 8)}`, labId],
  )).rows[0].id;
  await db.query(`insert into sales_invoice_items (invoice_id, product_id, qty, rate) values ($1,$2,$3,$4)`, [inv, productId, qty, rate]);
  return inv;
}

test("invoice payment lifecycle: submit, partial, full — status and outstanding follow", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);
  const inv = await draftInvoice(db, labId, productId, 2, 100); // total 200

  await db.query(`select fn_submit_sales_invoice($1)`, [inv]);
  let row = (await db.query(`select status, total_amount, outstanding from sales_invoices where id=$1`, [inv])).rows[0];
  assert.equal(row.status, "unpaid");
  assert.equal(Number(row.total_amount), 200);
  assert.equal(Number(row.outstanding), 200);

  const out1 = (await db.query(`select fn_record_invoice_payment($1,$2) as o`, [inv, 50])).rows[0].o;
  assert.equal(Number(out1), 150, "outstanding after partial payment");
  row = (await db.query(`select status from sales_invoices where id=$1`, [inv])).rows[0];
  assert.equal(row.status, "partly_paid");

  const out2 = (await db.query(`select fn_record_invoice_payment($1,$2) as o`, [inv, 150])).rows[0].o;
  assert.equal(Number(out2), 0, "fully settled");
  row = (await db.query(`select status from sales_invoices where id=$1`, [inv])).rows[0];
  assert.equal(row.status, "paid");
  await db.close();
});

test("invoice payments cannot overpay, and a draft or cancelled invoice takes no payment", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);
  const inv = await draftInvoice(db, labId, productId, 1, 100); // total 100

  // Draft invoice rejects payment.
  await assert.rejects(() => db.query(`select fn_record_invoice_payment($1,$2)`, [inv, 10]), /not open for payment/i);

  await db.query(`select fn_submit_sales_invoice($1)`, [inv]);
  // Overpayment rejected.
  await assert.rejects(() => db.query(`select fn_record_invoice_payment($1,$2)`, [inv, 150]), /exceeds/i);
  // Non-positive rejected.
  await assert.rejects(() => db.query(`select fn_record_invoice_payment($1,$2)`, [inv, 0]), /positive/i);

  // Cancelled invoice rejects payment, and nothing was recorded by the failed tries.
  await db.query(`update sales_invoices set status='cancelled' where id=$1`, [inv]);
  await assert.rejects(() => db.query(`select fn_record_invoice_payment($1,$2)`, [inv, 10]), /not open for payment/i);
  const paid = (await db.query(`select paid_amount from sales_invoices where id=$1`, [inv])).rows[0].paid_amount;
  assert.equal(Number(paid), 0, "no partial money leaked from rejected payments");
  await db.close();
});

test("fn_invoice_from_sales_order copies every line at the same qty and rate", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);
  const so = (await db.query(`insert into sales_orders (lab_id) values ($1) returning id`, [labId])).rows[0].id;
  await db.query(`insert into sales_order_items (sales_order_id, product_id, qty, rate) values ($1,$2,4,25)`, [so, productId]);

  const inv = (await db.query(`select fn_invoice_from_sales_order($1,$2) as id`, [so, `INV-${Math.random().toString(16).slice(2, 8)}`])).rows[0].id;
  const line = (await db.query(`select qty, rate, amount from sales_invoice_items where invoice_id=$1`, [inv])).rows[0];
  assert.equal(Number(line.qty), 4);
  assert.equal(Number(line.rate), 25);
  assert.equal(Number(line.amount), 100, "amount = qty * rate");
  const total = (await db.query(`select total_amount from sales_invoices where id=$1`, [inv])).rows[0].total_amount;
  assert.equal(Number(total), 100, "header total synced from the copied line");
  await db.close();
});
