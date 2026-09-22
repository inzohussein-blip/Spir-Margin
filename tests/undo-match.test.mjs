// Undoing a match (migration 0101). Matching was one-way: the action existed
// in code, no screen called it, and the workbench lists only unreconciled
// lines — so a line matched to the wrong payment vanished and stayed wrong.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

async function setup(db) {
  const acct = (await db.query(
    `insert into bank_accounts (account_name,bank,currency)
     values ('الجاري','الرافدين','USD') returning id`)).rows[0].id;
  const a = (await db.query(
    `insert into payment_entries (payment_type,party_name,received_amount,paid_amount,posting_date)
     values ('receive','مختبر النور',600,0,current_date) returning id`)).rows[0].id;
  const b = (await db.query(
    `insert into payment_entries (payment_type,party_name,received_amount,paid_amount,posting_date)
     values ('receive','مختبر الرشيد',400,0,current_date) returning id`)).rows[0].id;
  const txn = (await db.query(
    `insert into bank_transactions (bank_account_id,date,deposit,withdrawal,description)
     values ($1,current_date,1000,0,'إيداع مشترك') returning id`, [acct])).rows[0].id;
  return { acct, a, b, txn };
}

test("one allocation can be undone without touching the other", async () => {
  const db = await bootWithMigrations();
  const { acct, a, b, txn } = await setup(db);
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, a]);
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, b]);

  let rows = (await db.query(`select alloc_id, allocated from fn_allocations($1)`, [acct])).rows;
  assert.equal(rows.length, 2);
  const four = rows.find((r) => Number(r.allocated) === 400);

  await db.query(`select fn_unallocate_as($1,$2)`, [four.alloc_id, "admin@spir.local"]);
  rows = (await db.query(`select allocated from fn_allocations($1)`, [acct])).rows;
  assert.equal(rows.length, 1);
  assert.equal(Number(rows[0].allocated), 600);
  await db.close();
});

test("undoing reopens the bank line for exactly the amount freed", async () => {
  const db = await bootWithMigrations();
  const { acct, a, b, txn } = await setup(db);
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, a]);
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, b]);
  let t = (await db.query(`select status, unallocated_amount from bank_transactions where id=$1`, [txn])).rows[0];
  assert.equal(t.status, "reconciled");

  const four = (await db.query(
    `select alloc_id from fn_allocations($1) where allocated = 400`, [acct])).rows[0];
  await db.query(`select fn_unallocate_as($1,null)`, [four.alloc_id]);

  t = (await db.query(`select status, unallocated_amount from bank_transactions where id=$1`, [txn])).rows[0];
  assert.equal(t.status, "unreconciled");
  assert.equal(Number(t.unallocated_amount), 400);
  await db.close();
});

test("the freed payment becomes open again, the other does not", async () => {
  const db = await bootWithMigrations();
  const { acct, a, b, txn } = await setup(db);
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, a]);
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, b]);
  const four = (await db.query(
    `select alloc_id from fn_allocations($1) where allocated = 400`, [acct])).rows[0];
  await db.query(`select fn_unallocate_as($1,null)`, [four.alloc_id]);

  const open = (await db.query(`select party_name, remaining from fn_open_payments()`)).rows;
  assert.equal(open.length, 1);
  assert.equal(open[0].party_name, "مختبر الرشيد");
  assert.equal(Number(open[0].remaining), 400);
  await db.close();
});

test("an undo is recorded in the action log, attributed", async () => {
  const db = await bootWithMigrations();
  const { acct, a, txn } = await setup(db);
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, a]);
  const one = (await db.query(`select alloc_id from fn_allocations($1)`, [acct])).rows[0];
  await db.query(`select fn_unallocate_as($1,$2)`, [one.alloc_id, "admin@spir.local"]);

  const rows = (await db.query(`select action, actor from fn_bank_action_log($1,5)`, [acct])).rows;
  assert.equal(rows[0].action, "unmatch");
  assert.equal(rows[0].actor, "admin@spir.local");
  await db.close();
});

test("the matched list is scoped to its account and date window", async () => {
  const db = await bootWithMigrations();
  const { acct, a, txn } = await setup(db);
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, a]);
  const inWindow = (await db.query(
    `select 1 from fn_allocations($1, (current_date - 1)::date, (current_date + 1)::date)`, [acct])).rows;
  const outside = (await db.query(
    `select 1 from fn_allocations($1, (current_date + 5)::date, (current_date + 9)::date)`, [acct])).rows;
  assert.equal(inWindow.length, 1);
  assert.equal(outside.length, 0);
  await db.close();
});
