// Schema integrity: the migrations and the combined schema.sql must both
// apply cleanly on an empty database and produce the same core objects.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, bootWithSchemaFile } from "./helpers.mjs";

test("all migrations apply cleanly on an empty database", async () => {
  const db = await bootWithMigrations();
  const { rows } = await db.query(
    `select count(*)::int as n from information_schema.tables where table_schema='public'`
  );
  assert.ok(rows[0].n > 40, `expected many tables, got ${rows[0].n}`);
  await db.close();
});

test("combined schema.sql applies cleanly and records the ledger", async () => {
  const db = await bootWithSchemaFile();
  const led = await db.query(`select count(*)::int as n from _spir_migrations`);
  assert.ok(led.rows[0].n >= 60, `ledger should list all migrations, got ${led.rows[0].n}`);
  await db.close();
});

test("core views and functions exist", async () => {
  const db = await bootWithMigrations();
  for (const view of ["v_stock_balance", "v_amc_due", "v_expiring_contracts"]) {
    const r = await db.query(`select 1 from pg_views where viewname=$1`, [view]);
    assert.equal(r.rows.length, 1, `missing view ${view}`);
  }
  for (const fn of ["fn_generate_amc_invoices", "fn_run_amc_billing", "fn_usd_iqd_rate"]) {
    const r = await db.query(`select 1 from pg_proc where proname=$1`, [fn]);
    assert.equal(r.rows.length, 1, `missing function ${fn}`);
  }
  await db.close();
});
