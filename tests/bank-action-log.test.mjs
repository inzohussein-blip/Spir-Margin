// Reconciliation action log (migration 0099). The workbench used to keep this
// list in the browser's localStorage; it now comes from the audit trail, so it
// must survive a different browser, a different machine, and record who acted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

async function seed(db) {
  const account = (await db.query(
    `insert into bank_accounts (account_name,bank,currency)
     values ('الحساب الجاري','مصرف الرافدين','USD') returning id`)).rows[0].id;
  const payment = (await db.query(
    `insert into payment_entries (payment_type,party_name,received_amount,paid_amount,posting_date,reference_no)
     values ('receive','مختبر النور',1500,0,current_date,'REF-9') returning id`)).rows[0].id;
  const txn = (await db.query(
    `insert into bank_transactions (bank_account_id,date,deposit,withdrawal,description,reference_number)
     values ($1,current_date,1500,0,'إيداع مختبر النور','REF-9') returning id`, [account])).rows[0].id;
  return { account, payment, txn };
}

test("a match and an unmatch both land in the action log", async () => {
  const db = await bootWithMigrations();
  const { account, payment, txn } = await seed(db);

  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, payment]);
  let rows = (await db.query(`select action, detail from fn_bank_action_log($1,10)`, [account])).rows;
  assert.deepEqual(rows.map((r) => r.action), ["match"]);
  assert.match(rows[0].detail, /مختبر النور/);

  await db.query(`select fn_unreconcile_transaction($1)`, [txn]);
  rows = (await db.query(`select action from fn_bank_action_log($1,10)`, [account])).rows;
  assert.deepEqual(rows.map((r) => r.action), ["unmatch", "match"]); // newest first
  await db.close();
});

// The app calls the `_as` wrappers, which carry the acting user in the same
// statement; a separate `set_config` round trip could be interleaved by another
// request on the single embedded connection.
test("the log records who reconciled, from the wrapper the app calls", async () => {
  const db = await bootWithMigrations();
  const { account, payment, txn } = await seed(db);
  await db.query(`select fn_reconcile_transaction_as($1,$2,null,$3)`, [txn, payment, "admin@spir.local"]);
  const r = (await db.query(`select actor from fn_bank_action_log($1,1)`, [account])).rows[0];
  assert.equal(r.actor, "admin@spir.local");
  await db.close();
});

test("the actor does not leak to the next statement", async () => {
  const db = await bootWithMigrations();
  const { account, payment, txn } = await seed(db);
  await db.query(`select fn_reconcile_transaction_as($1,$2,null,$3)`, [txn, payment, "admin@spir.local"]);
  // set_config(..., true) is transaction-local, so a later change is unattributed
  // rather than wrongly credited to whoever acted last.
  await db.query(`select fn_unreconcile_transaction($1)`, [txn]);
  const rows = (await db.query(`select action, actor from fn_bank_action_log($1,5)`, [account])).rows;
  assert.equal(rows[0].action, "unmatch");
  assert.equal(rows[0].actor, null);
  assert.equal(rows[1].actor, "admin@spir.local");
  await db.close();
});

test("the log is scoped to one bank account", async () => {
  const db = await bootWithMigrations();
  const { account, payment, txn } = await seed(db);
  const other = (await db.query(
    `insert into bank_accounts (account_name,bank,currency)
     values ('حساب آخر','مصرف بغداد','USD') returning id`)).rows[0].id;
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, payment]);
  const mine = (await db.query(`select 1 from fn_bank_action_log($1,10)`, [account])).rows;
  const theirs = (await db.query(`select 1 from fn_bank_action_log($1,10)`, [other])).rows;
  assert.equal(mine.length, 1);
  assert.equal(theirs.length, 0);
  await db.close();
});

test("reconciliation stays out of the sync change log's noise but the audit row remains", async () => {
  const db = await bootWithMigrations();
  const { payment, txn } = await seed(db);
  await db.query(`select fn_reconcile_transaction($1,$2,null)`, [txn, payment]);
  const audited = (await db.query(
    `select count(*)::int as n from audit_log where table_name='bank_transaction_payments'`)).rows[0].n;
  assert.equal(audited, 1);
  const synced = (await db.query(
    `select count(*)::int as n from _spir_changes where table_name='audit_log'`)).rows[0].n;
  assert.equal(synced, 0); // audit_log is deliberately excluded from sync
  await db.close();
});
