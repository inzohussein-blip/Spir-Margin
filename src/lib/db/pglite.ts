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

// The connection singleton lives on globalThis, not in module scope: Next.js
// can load this module more than once (separate server-action and RSC bundles,
// plus dev HMR), and a per-module `let` would then open a SECOND PGlite
// instance against the same data dir — so a write on one instance would be
// invisible to a read on the other. A global handle guarantees every code path
// shares exactly one database connection.
interface DbSingleton {
  fkMeta: FkMeta | null;
  dbRef: Db | null;
  bootPromise: Promise<{ db: Db; meta: FkMeta }> | null;
}
const g = globalThis as unknown as { __spirDb?: DbSingleton };
const singleton: DbSingleton = (g.__spirDb ??= { fkMeta: null, dbRef: null, bootPromise: null });

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

  // Queries run as the bootstrap superuser, so RLS is bypassed (single-tenant
  // app). pgcrypto is already loaded via the constructor above.
  await initSchema({
    exec: (sql) => pg.exec(sql).then(() => undefined),
    query: (sql, params) => pg.query(sql, params) as Promise<{ rows: any[] }>,
  });
  return pg as unknown as Db;
}

/**
 * Apply any migration file that has not yet been recorded in `_spir_migrations`.
 *
 * This replaces the old one-shot bootstrap, which only ran migrations when the
 * database had never been initialised — meaning migrations added *after* the
 * first boot were silently skipped on a persisted data dir, and pages querying
 * the new tables threw "relation does not exist".
 *
 * Re-running an already-applied migration is unsafe here: several early
 * migrations carry unguarded top-level `insert`s (master data) that would
 * duplicate rows, and view/function migrations use `create or replace` that a
 * *later* migration may already have superseded (replacing a view with fewer
 * columns fails). Migrations are a strictly-ordered, contiguously-applied
 * sequence, so for a pre-existing database that predates the ledger we find the
 * prefix boundary — the first migration whose table/view does not yet exist —
 * mark everything before it as applied *without* re-executing, then run only
 * that boundary and everything after it.
 */
const RELATION_RE =
  /create\s+(?:or\s+replace\s+)?(?:materialized\s+view|view|table)\s+(?:if\s+not\s+exists\s+)?([a-z0-9_]+)/i;

/**
 * Minimal backend-agnostic runner so the migrator works over both PGlite
 * (`pg.exec`/`pg.query`) and node-postgres (`client.query`). `exec` runs a
 * possibly-multi-statement SQL string with no parameters; `query` runs a single
 * parameterised statement.
 */
interface Runner {
  exec(sql: string): Promise<void>;
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

async function applyPendingMigrations(run: Runner): Promise<void> {
  await run.exec(
    `create table if not exists _spir_migrations (
       filename text primary key,
       applied_at timestamptz not null default now()
     );`
  );

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
  const ledger = await run.query<{ filename: string }>(`select filename from _spir_migrations`);
  const applied = new Set(ledger.rows.map((r) => r.filename));

  // One-time back-fill for databases created before the ledger existed: if the
  // ledger is empty but the DB was already bootstrapped (`_spir_meta` present),
  // treat the already-applied migrations as the contiguous prefix ending at the
  // first migration whose relation is missing, and record that prefix as applied
  // so it is never re-run.
  if (applied.size === 0) {
    const bootstrapped = await run.query<{ n: number }>(
      `select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='_spir_meta'`
    );
    if ((bootstrapped.rows[0]?.n ?? 0) > 0) {
      let boundary = files.length;
      for (let i = 0; i < files.length; i++) {
        const rel = fs.readFileSync(path.join(MIGRATIONS_DIR, files[i]), "utf8").match(RELATION_RE)?.[1];
        if (!rel) continue; // no probeable relation: let its position be decided by neighbours
        const exists = await run.query<{ reg: string | null }>(
          `select to_regclass('public.' || $1) as reg`,
          [rel]
        );
        if (!exists.rows[0]?.reg) {
          boundary = i;
          break;
        }
      }
      for (let i = 0; i < boundary; i++) {
        await run.query(`insert into _spir_migrations(filename) values ($1) on conflict do nothing`, [files[i]]);
        applied.add(files[i]);
      }
    }
  }

  for (const f of files) {
    if (applied.has(f)) continue;
    await run.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), "utf8"));
    await run.query(`insert into _spir_migrations(filename) values ($1) on conflict do nothing`, [f]);
    applied.add(f);
  }
}

/** Ensure the `authenticated` role, apply pending migrations, then seed once. */
async function initSchema(run: Runner): Promise<void> {
  // RLS policies reference the "authenticated" role — it must exist. On a hosted
  // Supabase database it already does, so the guard simply no-ops.
  await run.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;`);

  await applyPendingMigrations(run);

  // Seed runs exactly once, on a genuinely fresh database, gated by the
  // `_spir_meta` marker — so redeploys and migration top-ups never re-seed.
  const seeded = await run.query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='_spir_meta'`
  );
  if ((seeded.rows[0]?.n ?? 0) === 0) {
    if (fs.existsSync(SEED_FILE)) await run.exec(fs.readFileSync(SEED_FILE, "utf8"));
    await run.exec(`create table if not exists _spir_meta (k text primary key);
      insert into _spir_meta(k) values ('bootstrapped') on conflict do nothing;`);
  }
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

  // Auto-apply this project's migrations to the hosted database (e.g. Supabase),
  // so a Vercel deploy "just works" once DATABASE_URL is set. It is idempotent
  // (a `_spir_migrations` ledger records applied files) and cheap after the first
  // run. A session advisory lock on a single dedicated connection serialises
  // concurrent serverless cold starts so only one instance migrates at a time.
  // Set SPIR_SKIP_MIGRATIONS=1 to opt out (if you apply migrations yourself).
  if (process.env.SPIR_SKIP_MIGRATIONS !== "1") {
    const client = await pool.connect();
    try {
      await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
      // gen_random_uuid() lives in core on PG13+, but keep pgcrypto available for
      // any other crypto helpers. Non-fatal if the role lacks CREATE privileges.
      try {
        await client.query("create extension if not exists pgcrypto");
      } catch {
        /* extension already present or insufficient privilege — safe to ignore */
      }
      await initSchema({
        exec: (sql) => client.query(sql).then(() => undefined),
        query: (sql, params) => client.query(sql, params as any[]).then((r) => ({ rows: r.rows })),
      });
    } finally {
      await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => undefined);
      client.release();
    }
  }

  return {
    async query<T = any>(sql: string, params: unknown[] = []) {
      const r = await pool.query(sql, params as any[]);
      return { rows: r.rows as T[], affectedRows: r.rowCount ?? undefined };
    },
  };
}

// Arbitrary fixed key identifying the schema-migration advisory lock.
const MIGRATION_LOCK_KEY = 5_713_002;

async function bootstrap(): Promise<{ db: Db; meta: FkMeta }> {
  const url = process.env.DATABASE_URL;
  const db = url ? await bootPostgres(url) : await bootPglite();
  const meta = await introspect(db);
  return { db, meta };
}

export async function getDb(): Promise<{ db: Db; meta: FkMeta }> {
  if (singleton.dbRef && singleton.fkMeta) return { db: singleton.dbRef, meta: singleton.fkMeta };
  singleton.bootPromise ??= bootstrap();
  const res = await singleton.bootPromise;
  singleton.dbRef = res.db;
  singleton.fkMeta = res.meta;
  return res;
}
