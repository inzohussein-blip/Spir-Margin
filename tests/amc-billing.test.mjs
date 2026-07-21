// Business logic: recurring AMC billing (migration 0064).
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

async function dueContract(db, { value, interval }) {
  const { labId, productId } = await ensureLabAndProduct(db);
  const no = "AMC-" + Math.random().toString(36).slice(2, 8);
  await db.query(
    `insert into contracts
       (contract_no, lab_id, status, start_date, end_date, contract_value,
        billing_interval, service_product_id, next_billing_date)
     values ($1,$2,'active',current_date,current_date+365,$3,$4,$5,current_date)`,
    [no, labId, value, interval, productId]
  );
  return no;
}

test("period amount = annual value / periods per interval", async () => {
  const db = await bootWithMigrations();
  const cases = [["monthly", 1200, "100.00"], ["quarterly", 4800, "1200.00"], ["annually", 900, "900.00"]];
  for (const [interval, value, expected] of cases) {
    const r = await db.query(`select fn_amc_period_amount($1,$2) as a`, [value, interval]);
    assert.equal(r.rows[0].a, expected, `${interval} of ${value}`);
  }
  await db.close();
});

test("generating creates a draft invoice with the pro-rated total", async () => {
  const db = await bootWithMigrations();
  const no = await dueContract(db, { value: 2400, interval: "monthly" });
  const gen = await db.query(`select * from fn_generate_amc_invoices()`);
  const mine = gen.rows.filter((r) => r.contract_no === no);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].amount, "200.00");

  const inv = await db.query(
    `select status, total_amount from sales_invoices where invoice_no like $1`,
    ["AMC-" + no + "%"]
  );
  assert.equal(inv.rows[0].status, "draft");
  assert.equal(inv.rows[0].total_amount, "200.00"); // synced by the item trigger
  await db.close();
});

test("re-running does not double-bill the same period", async () => {
  const db = await bootWithMigrations();
  const no = await dueContract(db, { value: 2400, interval: "monthly" });
  await db.query(`select * from fn_generate_amc_invoices()`);
  const second = await db.query(`select * from fn_generate_amc_invoices()`);
  assert.equal(second.rows.filter((r) => r.contract_no === no).length, 0);

  const count = await db.query(
    `select count(*)::int as n from sales_invoices where invoice_no like $1`,
    ["AMC-" + no + "%"]
  );
  assert.equal(count.rows[0].n, 1);
  await db.close();
});

test("billing advances next_billing_date and stamps last_billed_date", async () => {
  const db = await bootWithMigrations();
  const no = await dueContract(db, { value: 1200, interval: "monthly" });
  await db.query(`select fn_run_amc_billing()`);
  const c = await db.query(
    `select next_billing_date, last_billed_date from contracts where contract_no=$1`,
    [no]
  );
  const next = new Date(c.rows[0].next_billing_date);
  const last = new Date(c.rows[0].last_billed_date);
  assert.ok(next > last, "next_billing_date should be after last_billed_date");
  const days = Math.round((next - last) / 864e5);
  assert.ok(days >= 28 && days <= 31, `~1 month apart, got ${days} days`);
  await db.close();
});

test("fn_run_amc_billing returns the number of invoices generated", async () => {
  const db = await bootWithMigrations();
  await dueContract(db, { value: 1200, interval: "monthly" });
  await dueContract(db, { value: 4800, interval: "quarterly" });
  const r = await db.query(`select fn_run_amc_billing() as n`);
  assert.equal(Number(r.rows[0].n), 2);
  await db.close();
});

test("contracts with no interval or no service item are never billed", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);
  await db.query(
    `insert into contracts (contract_no, lab_id, status, contract_value, billing_interval, next_billing_date)
     values ('AMC-NONE',$1,'active',1200,'none',current_date)`,
    [labId]
  );
  const r = await db.query(`select fn_run_amc_billing() as n`);
  assert.equal(Number(r.rows[0].n), 0);
  await db.close();
});
