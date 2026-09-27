// The web version's local database migrates with the same files, in one
// batch: the same tables, functions and change-log triggers as a computer
// migrated one file at a time, and a second run does nothing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { bootWithMigrations, importTs, MIGRATIONS_DIR } from "./helpers.mjs";

const m = await importTs("src/lib/local/migrate.ts");
const bundle = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()
  .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name), "utf8") }));

const shape = async (db) => ({
  tables: (await db.query(`select count(*)::int n from information_schema.tables where table_schema='public' and table_name not in ('_spir_migrations','_spir_meta')`)).rows[0].n,
  functions: (await db.query(`select count(*)::int n from pg_proc p join pg_namespace s on s.oid=p.pronamespace where s.nspname='public'`)).rows[0].n,
  changeLog: (await db.query(`select count(*)::int n from pg_trigger where tgname = 'zz_spir_change_log'`)).rows[0].n,
});

test("one batch gives the schema the file-by-file migrator gives", async () => {
  const local = new PGlite({ extensions: { pgcrypto } });
  const applied = await m.migrateLocal(local, bundle);
  assert.equal(applied.length, bundle.length);
  assert.equal((await local.query(`select count(*)::int n from _spir_migrations`)).rows[0].n, bundle.length);
  const ref = await bootWithMigrations();
  const a = await shape(local), b = await shape(ref);
  assert.equal(a.tables, b.tables);
  assert.ok(a.changeLog > 100, "every synced table has its change log");
  assert.ok(a.functions >= b.functions);
  assert.equal((await local.query(`select current_setting('spir.syncing', true) as s`)).rows[0].s, "off", "later writes are logged");
  // A write after migrating enters the change log (what sync sends).
  await local.query(`insert into labs (code, name) values ('L-1', 'مختبر')`);
  assert.equal((await local.query(`select count(*)::int n from _spir_changes where table_name = 'labs'`)).rows[0].n, 1);
  assert.deepEqual(await m.migrateLocal(local, bundle), [], "a second run does nothing");
  await ref.close();
  await local.close();
});

test("a new migration later is applied on its own", async () => {
  const local = new PGlite({ extensions: { pgcrypto } });
  await m.migrateLocal(local, bundle.slice(0, -1));
  assert.deepEqual(await m.migrateLocal(local, bundle), [bundle.at(-1).name]);
  await local.close();
});
