// Cloud sync (src/lib/cloud/serve.ts): the web version's local database (a
// browser's Postgres, migrated with the bundle) syncs with its company's
// hosted database through the site — both directions, and a browser that
// arrives after the company's log was pruned takes a full copy first.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { bootWithMigrations, importTs, importTsLinked, MIGRATIONS_DIR } from "./helpers.mjs";

const core = await importTs("src/lib/sync/core.ts");
const cloud = await importTsLinked("src/lib/cloud/serve.ts", { "../sync/core": "src/lib/sync/core.ts" });
const mig = await importTs("src/lib/local/migrate.ts");
const bundle = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()
  .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8") }));

async function browserDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await mig.migrateLocal(db, bundle);
  return db;
}
// What travels between browser and site is JSON, both ways.
const wire = (company) => async (req) => JSON.parse(JSON.stringify(await cloud.serveCloud(company, JSON.parse(JSON.stringify(req)))));
const count = async (db, sql, p = []) => (await db.query(sql, p)).rows[0].n;

test("a browser's sale reaches the company, and the company's record reaches the browser", async () => {
  const company = await bootWithMigrations();
  const browser = await browserDb();
  const me = await core.nodeId(browser);
  const peer = cloud.cloudPeer(wire(company), me);

  await browser.query(`insert into labs (code, name) values ('WEB-1', 'مختبر من المتصفح')`);
  const first = await core.syncOnce(browser, peer);
  assert.equal(first.ok, true, first.error);
  assert.equal(await count(company, `select count(*)::int n from labs where code = 'WEB-1'`), 1);

  await company.query(`insert into labs (code, name) values ('HQ-1', 'مختبر من المكتب')`);
  const second = await core.syncOnce(browser, peer);
  assert.equal(second.ok, true, second.error);
  assert.equal(await count(browser, `select count(*)::int n from labs where code = 'HQ-1'`), 1);
  assert.equal((await core.syncOnce(browser, peer)).pushed, 0, "a further pass sends nothing back");

  const hello = await wire(company)({ op: "hello", node: me });
  assert.equal(hello.node, await core.nodeId(company));
  await assert.rejects(() => cloud.serveCloud(company, { op: "push", node: "not-a-node", rows: [] }));
  await assert.rejects(() => cloud.serveCloud(company, { op: "drop", node: me }));
  await company.close(); await browser.close();
});

test("a browser arriving after the company's log was pruned takes a full copy", async () => {
  const company = await bootWithMigrations();
  for (let i = 0; i < 5; i++) await company.query(`insert into labs (code, name) values ($1, $2)`, [`OLD-${i}`, `مختبر ${i}`]);
  await company.query(`insert into labs (code, name) values ('KEEP', 'باقٍ في السجل')`);
  await company.query(`delete from _spir_changes where seq < (select max(seq) from _spir_changes)`);
  const browser = await browserDb();
  const r = await core.syncOnce(browser, cloud.cloudPeer(wire(company), await core.nodeId(browser)));
  assert.equal(r.ok, true, r.error);
  assert.equal(await count(browser, `select count(*)::int n from labs where code like 'OLD-%' or code = 'KEEP'`), 6);
  await company.close(); await browser.close();
});

test("an invoice made, submitted and paid in a browser arrives paid", async () => {
  const company = await bootWithMigrations();
  const browser = await browserDb();
  const peer = cloud.cloudPeer(wire(company), await core.nodeId(browser));
  const one = async (sql, p = []) => (await browser.query(sql, p)).rows[0];
  const lab = await one(`insert into labs (code, name) values ('P-1', 'مختبر') returning id`);
  const prod = await one(`insert into products (item_code, name, product_type, default_sell_price) values ('P-P', 'صنف', 'spare_part', 10) returning id`);
  assert.equal((await core.syncOnce(browser, peer)).ok, true);
  const inv = await one(`insert into sales_invoices (invoice_no, lab_id) values ('SI-P-1', $1) returning id`, [lab.id]);
  await browser.query(`insert into sales_invoice_items (invoice_id, product_id, qty, rate) values ($1, $2, 3, 10)`, [inv.id, prod.id]);
  await browser.query(`select fn_submit_sales_invoice($1)`, [inv.id]);
  await browser.query(`select fn_record_invoice_payment($1, 30)`, [inv.id]);
  const here = await one(`select status, paid_amount::int as paid from sales_invoices where id = $1`, [inv.id]);
  assert.deepEqual(here, { status: "paid", paid: 30 });
  const r = await core.syncOnce(browser, peer);
  assert.equal(r.ok, true, r.error);
  const rejects = (await company.query(`select * from _spir_sync_rejects`)).rows.concat((await browser.query(`select * from _spir_sync_rejects`)).rows);
  assert.deepEqual(rejects, []);
  const there = (await company.query(`select status, paid_amount::int as paid from sales_invoices where id = $1`, [inv.id])).rows[0];
  assert.deepEqual(there, { status: "paid", paid: 30 });
  await company.close(); await browser.close();
});
