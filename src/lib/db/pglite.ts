import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Embedded Postgres (PGlite / WASM) that runs the project's own SQL migrations
 * and plpgsql functions in-process — no external Supabase/Postgres needed.
 *
 * The instance is a singleton, persisted to a local data directory so rows
 * survive restarts. Delete that directory to reset to a clean seeded state.
 */

const DATA_DIR = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".pglite-data");
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const SEED_FILE = path.join(process.cwd(), "supabase", "seed.sql");

export interface FkMeta {
  // outgoing[table] = [{ column, ftable }]  (this table references ftable via column)
  outgoing: Record<string, { column: string; ftable: string }[]>;
  // columns[table] = Set of column names
  columns: Record<string, Set<string>>;
  tables: Set<string>;
}

let instance: PGlite | null = null;
let fkMeta: FkMeta | null = null;
let bootPromise: Promise<{ db: PGlite; meta: FkMeta }> | null = null;

async function introspect(db: PGlite): Promise<FkMeta> {
  const cols = await db.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public'`
  );
  const fks = await db.query<{
    table_name: string;
    column_name: string;
    foreign_table_name: string;
  }>(
    `select tc.table_name, kcu.column_name, ccu.table_name as foreign_table_name
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on tc.constraint_name = kcu.constraint_name and tc.table_schema = kcu.table_schema
     join information_schema.constraint_column_usage ccu
       on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
     where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`
  );
  const meta: FkMeta = { outgoing: {}, columns: {}, tables: new Set() };
  for (const r of cols.rows) {
    meta.tables.add(r.table_name);
    (meta.columns[r.table_name] ??= new Set()).add(r.column_name);
  }
  for (const r of fks.rows) {
    (meta.outgoing[r.table_name] ??= []).push({
      column: r.column_name,
      ftable: r.foreign_table_name,
    });
  }
  return meta;
}

// Return date/time types as their Postgres text form (strings) instead of JS
// Date objects, matching what supabase-js/PostgREST hands the app (pages render
// these values directly, and a Date object is not a valid React child).
const asText = (v: string) => v;
const DATE_OIDS = {
  1082: asText, // date
  1083: asText, // time
  1114: asText, // timestamp
  1184: asText, // timestamptz
  1266: asText, // timetz
};

async function bootstrap(): Promise<{ db: PGlite; meta: FkMeta }> {
  const db = new PGlite({
    dataDir: DATA_DIR,
    extensions: { pgcrypto },
    parsers: DATE_OIDS,
  });
  await db.waitReady;

  // RLS policies reference the "authenticated" role — it must exist. Queries
  // run as the bootstrap superuser, so RLS is bypassed (single-tenant app).
  await db.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated;
    end if;
  end $$;`);

  const already = await db.query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables
     where table_schema = 'public' and table_name = '_spir_meta'`
  );
  const bootstrapped = (already.rows[0]?.n ?? 0) > 0;

  if (!bootstrapped) {
    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8");
      await db.exec(sql);
    }
    if (fs.existsSync(SEED_FILE)) {
      await db.exec(fs.readFileSync(SEED_FILE, "utf8"));
    }
    await db.exec(`create table if not exists _spir_meta (k text primary key);
      insert into _spir_meta(k) values ('bootstrapped') on conflict do nothing;`);
  }

  const meta = await introspect(db);
  return { db, meta };
}

export async function getDb(): Promise<{ db: PGlite; meta: FkMeta }> {
  if (instance && fkMeta) return { db: instance, meta: fkMeta };
  bootPromise ??= bootstrap();
  const res = await bootPromise;
  instance = res.db;
  fkMeta = res.meta;
  return res;
}
