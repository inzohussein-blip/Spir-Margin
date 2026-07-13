import "server-only";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Data-source layer. Two interchangeable backends behind one `Db` interface:
 *
 *   • Embedded Postgres (PGlite/WASM) — the default. Runs this project's own
 *     SQL migrations + plpgsql functions in-process, persisted to a local data
 *     directory. Zero setup; ideal for local dev / a persistent Node server.
 *
 *   • Hosted Postgres (node-postgres) — used when DATABASE_URL is set (e.g. a
 *     Supabase/Neon connection string for a Vercel deployment). Migrations are
 *     assumed already applied to that database.
 *
 * Both expose `query(sql, params) -> { rows, affectedRows }`, and date/time
 * types are returned as strings (matching PostgREST) so pages render them.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Db {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>;
}

export interface FkMeta {
  outgoing: Record<string, { column: string; ftable: string }[]>;
  columns: Record<string, Set<string>>;
  tables: Set<string>;
}

const DATA_DIR = process.env.PGLITE_DATA_DIR || path.join(process.cwd(), ".pglite-data");
const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const SEED_FILE = path.join(process.cwd(), "supabase", "seed.sql");

// date, time, timestamp, timestamptz, timetz -> keep as text (not JS Date)
const DATE_OIDS = [1082, 1083, 1114, 1184, 1266];
const asText = (v: string) => v;

let fkMeta: FkMeta | null = null;
let dbRef: Db | null = null;
let bootPromise: Promise<{ db: Db; meta: FkMeta }> | null = null;

async function introspect(db: Db): Promise<FkMeta> {
  const cols = await db.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns where table_schema = 'public'`
  );
  const fks = await db.query<{ table_name: string; column_name: string; foreign_table_name: string }>(
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
    (meta.outgoing[r.table_name] ??= []).push({ column: r.column_name, ftable: r.foreign_table_name });
  }
  return meta;
}

// ---- embedded PGlite backend ----------------------------------------------

async function bootPglite(): Promise<Db> {
  const pg = new PGlite({
    dataDir: DATA_DIR,
    extensions: { pgcrypto },
    parsers: Object.fromEntries(DATE_OIDS.map((oid) => [oid, asText])),
  });
  await pg.waitReady;

  // RLS policies reference the "authenticated" role — it must exist. Queries
  // run as the bootstrap superuser, so RLS is bypassed (single-tenant app).
  await pg.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;`);

  const already = await pg.query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='_spir_meta'`
  );
  if ((already.rows[0]?.n ?? 0) === 0) {
    for (const f of fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
      await pg.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
    }
    if (fs.existsSync(SEED_FILE)) await pg.exec(fs.readFileSync(SEED_FILE, "utf8"));
    await pg.exec(`create table if not exists _spir_meta (k text primary key);
      insert into _spir_meta(k) values ('bootstrapped') on conflict do nothing;`);
  }
  return pg as unknown as Db;
}

// ---- hosted Postgres backend (node-postgres) ------------------------------

async function bootPostgres(url: string): Promise<Db> {
  const pgLib = (await import("pg")).default as typeof import("pg");
  // return date/time types as strings, matching PGlite + PostgREST
  for (const oid of DATE_OIDS) pgLib.types.setTypeParser(oid, asText);
  const pool = new pgLib.Pool({
    connectionString: url,
    ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: false },
    max: Number(process.env.PGPOOL_MAX ?? 5),
  });
  return {
    async query<T = any>(sql: string, params: unknown[] = []) {
      const r = await pool.query(sql, params as any[]);
      return { rows: r.rows as T[], affectedRows: r.rowCount ?? undefined };
    },
  };
}

async function bootstrap(): Promise<{ db: Db; meta: FkMeta }> {
  const url = process.env.DATABASE_URL;
  const db = url ? await bootPostgres(url) : await bootPglite();
  const meta = await introspect(db);
  return { db, meta };
}

export async function getDb(): Promise<{ db: Db; meta: FkMeta }> {
  if (dbRef && fkMeta) return { db: dbRef, meta: fkMeta };
  bootPromise ??= bootstrap();
  const res = await bootPromise;
  dbRef = res.db;
  fkMeta = res.meta;
  return res;
}
