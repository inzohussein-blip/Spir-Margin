// The data client's query builder (src/lib/db/rest-core.ts), run as is on an
// embedded Postgres with every migration — the same file the server uses on
// the computer's database and the web version's local app uses in the browser.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, importTs } from "./helpers.mjs";

const core = await importTs("src/lib/db/rest-core.ts");
let db, meta, client;
const failed = [];
before(async () => {
  db = await bootWithMigrations();
  meta = await core.introspect(db);
  client = new core.PgRestClient({
    open: async () => ({ db, meta }),
    error: core.plainDbError,
    failedRead: (_db, table, err) => failed.push([table, err.code]),
  });
});
after(async () => { await db.close(); });

test("insert, then select with an embedded row, a search that forgives spelling, a count and a page", async () => {
  const { data: lab, error } = await client.from("labs").insert({ code: "L-1", name: "مختبر البصرة", city: "البصرة" }).select("id").single();
  assert.equal(error, null);
  for (let i = 0; i < 7; i++) await client.from("labs").insert({ code: `L-X${i}`, name: `مختبر ${i}`, city: "بغداد" });
  const { data: found, count } = await client.from("labs").select("code, name", { count: "exact" }).search(["name", "city"], "البصره").order("code");
  assert.deepEqual(found.map((r) => r.code), ["L-1"]);
  assert.equal(count, 1);
  const page = await client.from("labs").select("code", { count: "exact" }).order("code").range(2, 4);
  assert.equal(page.data.length, 3);
  assert.equal(page.count, 8);

  const { data: inv } = await client.from("sales_invoices").insert({ invoice_no: "INV-1", lab_id: lab.id, posting_date: "2026-01-01" }).select("id").single();
  const { data: one } = await client.from("sales_invoices").select("invoice_no, labs(name)").eq("id", inv.id).single();
  assert.equal(one.labs.name, "مختبر البصرة", "the lab comes embedded, as supabase-js gives it");
});

test("functions: a set comes back as rows, a scalar as its value", async () => {
  await db.query(`select fn_create_user('boss@spir.test','right-pass','Boss','admin')`);
  const set = await client.rpc("fn_verify_login", { p_email: "boss@spir.test", p_password: "right-pass" });
  assert.equal(set.data[0].email, "boss@spir.test");
  const scalar = await client.rpc("fn_usd_iqd_rate");
  assert.equal(typeof Number(scalar.data), "number");
});

test("the guard refuses before the database is touched; a failed read is reported", async () => {
  const refusing = new core.PgRestClient({
    open: async () => ({ db, meta }),
    guard: async () => { throw new Error("not allowed"); },
    error: core.plainDbError,
  });
  const r = await refusing.from("labs").select("id");
  assert.deepEqual([r.data, r.error.code], [null, "42501"]);
  const bad = await client.from("labs").select("no_such_column");
  assert.ok(bad.error);
  assert.deepEqual(failed.at(-1)[0], "labs");
});
