// Schema integrity: the migrations and the combined schema.sql must both
// apply cleanly on an empty database and produce the same objects.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { bootWithMigrations, bootWithSchemaFile, loadSeed, MIGRATIONS_DIR, SCHEMA_FILE } from "./helpers.mjs";

const migrationFiles = () =>
  fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();

/** Every table / view / function / index name in the public schema. */
async function inventory(db) {
  const grab = async (sql) => (await db.query(sql)).rows.map((r) => Object.values(r)[0]).sort();
  return {
    tables: await grab(
      `select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'`,
    ),
    views: await grab(`select table_name from information_schema.views where table_schema='public'`),
    functions: await grab(
      `select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'`,
    ),
    indexes: await grab(`select indexname from pg_indexes where schemaname='public'`),
  };
}

test("all migrations apply cleanly on an empty database", async () => {
  const db = await bootWithMigrations();
  const { rows } = await db.query(
    `select count(*)::int as n from information_schema.tables where table_schema='public'`,
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

// schema.sql is the documented way to stand up a hosted database
// (docs/DEPLOYMENT.md runs `psql -f supabase/schema.sql`), and it drifted four
// migrations behind once because it was maintained by hand. These two tests
// make that impossible to miss: rebuild with `npm run schema`.
test("schema.sql lists every migration in its ledger", async () => {
  const files = migrationFiles();
  const db = await bootWithSchemaFile();
  const led = (await db.query(`select filename from _spir_migrations order by filename`)).rows.map(
    (r) => r.filename,
  );
  const missing = files.filter((f) => !led.includes(f));
  assert.deepEqual(
    missing,
    [],
    `schema.sql is stale — rebuild it with \`npm run schema\`. Missing: ${missing.join(", ")}`,
  );
  await db.close();
});

test("schema.sql produces the same objects as the migrations", async () => {
  const [fromMigrations, fromSchema] = await Promise.all([
    bootWithMigrations().then(async (db) => {
      const inv = await inventory(db);
      await db.close();
      return inv;
    }),
    bootWithSchemaFile().then(async (db) => {
      const inv = await inventory(db);
      await db.close();
      return inv;
    }),
  ]);

  for (const kind of ["tables", "views", "functions", "indexes"]) {
    const onlyInMigrations = fromMigrations[kind].filter((n) => !fromSchema[kind].includes(n));
    assert.deepEqual(
      onlyInMigrations,
      [],
      `schema.sql is missing ${kind}: ${onlyInMigrations.join(", ")} — rebuild with \`npm run schema\``,
    );
  }
});

// seed.sql is loaded as its own step (src/lib/db/pglite.ts on the embedded
// build, a second psql run on a hosted one) and not folded into schema.sql:
// it calls fn_create_portal_user, which writes the `customer` enum label that
// migration 0070 adds, and Postgres refuses a new enum value in the same
// transaction that created it.
test("the demo seed applies on top of the migrations", async () => {
  const db = await bootWithMigrations();
  await loadSeed(db);
  const { rows } = await db.query(
    `select count(*)::int as n from app_users where role = 'customer'`,
  );
  assert.ok(rows[0].n >= 1, "seed should create the portal (customer) user");
  await db.close();
});

test("schema.sql carries no demo data", async () => {
  // A hosted production database is stood up from schema.sql alone; demo
  // hospitals and demo invoices must not arrive with it.
  const db = await bootWithSchemaFile();
  for (const tbl of ["labs", "devices", "payment_entries"]) {
    const { rows } = await db.query(`select count(*)::int as n from ${tbl}`);
    assert.equal(rows[0].n, 0, `${tbl} should be empty in a schema-only bootstrap`);
  }
  await db.close();
});

test("migration filenames are uniquely numbered and ordered", () => {
  const nums = migrationFiles().map((f) => f.slice(0, 4));
  assert.equal(new Set(nums).size, nums.length, "two migrations share a number");
  assert.deepEqual([...nums].sort(), nums, "filenames do not sort in numeric order");
});

test("every foreign key has a covering index", async () => {
  const db = await bootWithMigrations();
  // Postgres indexes the referenced side automatically but not the
  // referencing one, so an unindexed FK makes every parent delete/update scan
  // the whole child table. Migration 0088 covers the existing ones; this
  // keeps a new table from reintroducing the problem.
  const { rows } = await db.query(`
    select conrelid::regclass::text as tbl, a.attname as col
      from pg_constraint c
      join lateral unnest(c.conkey) k(attnum) on true
      join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum
     where c.contype='f' and connamespace='public'::regnamespace
       and array_length(c.conkey,1)=1
       and not exists (
         select 1 from pg_index i where i.indrelid=c.conrelid and i.indkey[0]=k.attnum)
     order by 1,2`);
  assert.deepEqual(
    rows.map((r) => `${r.tbl}.${r.col}`),
    [],
    "add an index for these foreign keys (see migration 0088 for the pattern)",
  );
  await db.close();
});

test("no table has RLS enabled without a policy", async () => {
  const db = await bootWithMigrations();
  // RLS with no policy denies every row to a non-superuser, which reads as an
  // empty table rather than an error — a silent, hard-to-trace failure.
  const { rows } = await db.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' and c.relrowsecurity
       and not exists (
         select 1 from pg_policies p where p.schemaname='public' and p.tablename=c.relname)
     order by 1`);
  assert.deepEqual(rows.map((r) => r.relname), []);
  await db.close();
});

test("a hosted database's public API roles can reach nothing", async () => {
  // Supabase's REST API serves `public` to `anon` and `authenticated`. The app
  // never uses it (it connects directly), so 0104 takes every privilege away
  // from both. The roles exist only on Supabase, so they are made here first.
  const db = new PGlite({ extensions: { pgcrypto } });
  // Set up the way Supabase ships: both roles, granted everything created in
  // `public` by default.
  await db.exec(`
    create extension if not exists pgcrypto;
    create role anon; create role authenticated;
    alter default privileges in schema public grant all on tables    to anon, authenticated;
    alter default privileges in schema public grant all on sequences to anon, authenticated;
    alter default privileges in schema public grant all on functions to anon, authenticated;`);
  await db.exec(`select set_config('spir.syncing', 'on', false)`);
  for (const f of migrationFiles()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
  }
  const { rows } = await db.query(`
    select
      (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind in ('r', 'v', 'S')
          and (has_table_privilege('anon', c.oid, 'select, insert, update, delete')
               or has_table_privilege('authenticated', c.oid, 'select, insert, update, delete'))) as tables,
      (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and (has_function_privilege('anon', p.oid, 'execute')
               or has_function_privilege('authenticated', p.oid, 'execute'))) as functions`);
  assert.deepEqual(rows[0], { tables: 0, functions: 0 });

  // And a table added by a later migration is closed too.
  await db.exec(`create table later_table (id int primary key)`);
  const later = await db.query(`select has_table_privilege('anon', 'later_table', 'select') as ok`);
  assert.equal(later.rows[0].ok, false);
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
