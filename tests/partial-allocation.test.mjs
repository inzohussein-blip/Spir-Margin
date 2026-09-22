// Partial allocation (migration 0100). One payment rarely settles exactly one
// bank line in this business, so both sides must be able to carry a remainder.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

async function account(db) {
  return (await db.query(
    `insert into bank_accounts (account_name,bank,currency)
     values ('الجاري','الرافدين','USD') returning id`)).rows[0].id;
}
const payment = async (db, amount) =>
  (await db.query(
    `insert into payment_entries (payment_type,party_name,received_amount,paid_amount,posting_date)
     values ('receive','مختبر النور',$1,0,current_date) returning id`, [amount])).rows[0].id;
const line = async (db, acct, amount, label) =>
  (await db.query(
    `insert into bank_transactions (bank_account_id,date,deposit,withdrawal,description)
     values ($1,current_date,$2,0,$3) returning id`, [acct, amount, label])).rows[0].id;

test("one payment settles two bank lines and stays open in between", async () => {
  const db = await bootWithMigrations();
  const acct = await account(db);
  const pe = await payment(db, 1500);
  const a = await line(db, acct, 700, "أولى");
  const b = await line(db, acct, 800, "ثانية");

  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [a, pe]);
  let open = (await db.query(`select remaining from fn_open_payments()`)).rows;
  assert.equal(open.length, 1, "the payment must stay open while 800 is left");
  assert.equal(Number(open[0].remaining), 800);

  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [b, pe]);
  open = (await db.query(`select remaining from fn_open_payments()`)).rows;
  assert.equal(open.length, 0, "fully allocated, so no longer open");
  const r = (await db.query(`select is_reconciled from payment_entries where id=$1`, [pe])).rows[0];
  assert.equal(r.is_reconciled, true);
  await db.close();
});

test("a payment smaller than the line leaves the line partly unallocated", async () => {
  const db = await bootWithMigrations();
  const acct = await account(db);
  const pe = await payment(db, 1000);
  const big = await line(db, acct, 1500, "إيداع كبير");

  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [big, pe]);
  const t = (await db.query(
    `select status, allocated_amount, unallocated_amount from bank_transactions where id=$1`, [big])).rows[0];
  assert.equal(t.status, "unreconciled");
  assert.equal(Number(t.allocated_amount), 1000);
  assert.equal(Number(t.unallocated_amount), 500);
  await db.close();
});

test("allocating more than either side has left is refused", async () => {
  const db = await bootWithMigrations();
  const acct = await account(db);
  const pe = await payment(db, 9999);
  const small = await line(db, acct, 100, "صغير");
  await assert.rejects(
    () => db.query(`select fn_reconcile_transaction($1,$2,500)`, [small, pe]),
    /فقط للتخصيص/
  );
  await db.close();
});

test("older unreconciled lines outside the window are counted", async () => {
  const db = await bootWithMigrations();
  const acct = await account(db);
  await db.query(
    `insert into bank_transactions (bank_account_id,date,deposit,withdrawal,description)
     values ($1, current_date - 90, 250, 0, 'قديم'), ($1, current_date, 400, 0, 'حديث')`, [acct]);
  const r = (await db.query(
    `select n, total from fn_older_unreconciled($1, (current_date - 30)::date)`, [acct])).rows[0];
  assert.equal(r.n, 1);
  assert.equal(Number(r.total), 250);
  await db.close();
});

test("a fully settled payment no longer appears as open", async () => {
  const db = await bootWithMigrations();
  const acct = await account(db);
  const pe = await payment(db, 300);
  const l = await line(db, acct, 300, "تام");
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [l, pe]);
  const open = (await db.query(`select 1 from fn_open_payments()`)).rows;
  assert.equal(open.length, 0);
  const t = (await db.query(`select status from bank_transactions where id=$1`, [l])).rows[0];
  assert.equal(t.status, "reconciled");
  await db.close();
});

test("unmatching reopens both sides", async () => {
  const db = await bootWithMigrations();
  const acct = await account(db);
  const pe = await payment(db, 300);
  const l = await line(db, acct, 300, "تام");
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [l, pe]);
  await db.query(`select fn_unreconcile_transaction($1)`, [l]);
  const open = (await db.query(`select remaining from fn_open_payments()`)).rows;
  assert.equal(open.length, 1);
  assert.equal(Number(open[0].remaining), 300);
  const t = (await db.query(`select status, unallocated_amount from bank_transactions where id=$1`, [l])).rows[0];
  assert.equal(t.status, "unreconciled");
  assert.equal(Number(t.unallocated_amount), 300);
  await db.close();
});
