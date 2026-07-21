// Regression guard for the .rpc() return-shape routing in src/lib/db/rest.ts.
//
// The client picks `select fn()` (scalar) vs `select * from fn()` (rows) from
// each function's catalog `proretset` flag. If a set-returning function is
// mis-routed through the scalar path it collapses to a single composite string
// and callers that expect an array (login, global search) silently break.
// These tests pin the classification the client relies on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

async function proretset(db, fn) {
  const r = await db.query(
    `select bool_or(p.proretset) as s from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where p.proname = $1 and n.nspname = 'public'`,
    [fn]
  );
  return r.rows[0]?.s;
}

test("set-returning functions are classified as sets (routed to `select * from fn()`)", async () => {
  const db = await bootWithMigrations();
  for (const fn of ["fn_verify_login", "fn_global_search"]) {
    assert.equal(await proretset(db, fn), true, `${fn} must be set-returning`);
  }
  await db.close();
});

test("scalar/void functions are classified as scalar (routed to `select fn()`)", async () => {
  const db = await bootWithMigrations();
  for (const fn of ["fn_usd_iqd_rate", "fn_run_amc_billing", "fn_create_user", "fn_set_password"]) {
    assert.equal(await proretset(db, fn), false, `${fn} must be scalar`);
  }
  await db.close();
});

test("fn_verify_login yields row objects (the shape the login action consumes)", async () => {
  const db = await bootWithMigrations();
  const r = await db.query(`select * from fn_verify_login($1,$2)`, ["admin@spir.local", "admin1234"]);
  assert.equal(r.rows.length, 1);
  assert.ok(r.rows[0].id, "row must expose an id column");
  assert.equal(r.rows[0].role, "admin");
  await db.close();
});
