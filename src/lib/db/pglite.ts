import "server-only";
import fs from "node:fs";
import path from "node:path";

/**
 * Data-source layer — local-first, with the hosted database as a peer.
 *
 * The app is installed at one company, on machines that may have no hosted
 * database and no internet, so the EMBEDDED Postgres (PGlite/WASM) is the
 * working store. Every read and every write in the app goes there: `getDb()`
 * never needs configuration, never needs a network, and never fails because
 * something is unreachable.
 *
 * `DATABASE_URL`, when set, is not the store — it is a sync PEER. The sync
 * engine (`src/lib/sync/`) pushes local changes to it and pulls its changes
 * back, so a second computer, or a rebuilt one, converges with it. Losing the
 * connection degrades sync, never the app.
 *
 * Both backends are dynamic imports, and both run this project's own
 * migrations, so the two ends always share one schema — which is what lets
 * the change log on either side be replayed onto the other.
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

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");
const FULL_SEED_FILE = path.join(process.cwd(), "supabase", "seed.sql");
const DEMO_SEED_FILE = path.join(process.cwd(), "supabase", "seed-demo.sql");

/**
 * What a brand-new database starts with. `demo` (the default) is the small
 * Arabic starter dataset — enough to show a working system on first run, and
 * small enough to delete. `full` is the large ERP fixture, `none` an empty
 * database for a company importing its own data.
 */
function seedFile(): string | null {
  const choice = process.env.SPIR_SEED ?? "demo";
  if (choice === "none") return null;
  if (choice === "full") return fs.existsSync(FULL_SEED_FILE) ? FULL_SEED_FILE : null;
  if (fs.existsSync(DEMO_SEED_FILE)) return DEMO_SEED_FILE;
  return fs.existsSync(FULL_SEED_FILE) ? FULL_SEED_FILE : null;
}

// date, time, timestamp, timestamptz, timetz -> keep as text (not JS Date)
const DATE_OIDS = [1082, 1083, 1114, 1184, 1266];
const asText = (v: string) => v;

/**
 * Where PGlite keeps its files, or null to run entirely in memory.
 *
 * A serverless runtime (Vercel) mounts the deployment read-only, so writing
 * to `<cwd>/.pglite-data` throws on boot. There is also nothing to gain: the
 * filesystem is discarded between invocations. In-memory is the honest
 * choice there — each cold start serves a fresh copy of the demo dataset,
 * which is exactly what a trial should do. A normal Node server or desktop
 * install still persists so the trial survives restarts.
 */
function pgliteDataDir(): string | null {
  const explicit = process.env.PGLITE_DATA_DIR;
  if (explicit) return explicit === "memory" ? null : explicit;
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) return null;
  const dir = path.join(process.cwd(), ".pglite-data");
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return dir;
  } catch {
    return null; // read-only filesystem — fall back to memory
  }
}

// The connection singletons live on globalThis, not in module scope: Next.js
// can load this module more than once (separate server-action and RSC bundles,
// plus dev HMR), and a per-module `let` would then open a SECOND PGlite
// instance against the same data dir — so a write on one instance would be
// invisible to a read on the other. A global handle guarantees every code path
// shares exactly one connection to the local store, and at most one pool to
// the remote peer.
interface DbSingleton {
  fkMeta: FkMeta | null;
  dbRef: Db | null;
  bootPromise: Promise<{ db: Db; meta: FkMeta }> | null;
  /** The raw PGlite behind `dbRef`, which backup and restore need. */
  raw?: PgliteHandle | null;
}

/** The slice of PGlite's own API this module uses beyond `Db`. */
interface PgliteHandle {
  dumpDataDir(): Promise<Blob | File>;
  close(): Promise<void>;
}
const fresh = (): DbSingleton => ({ fkMeta: null, dbRef: null, bootPromise: null, raw: null });
const g = globalThis as unknown as { __spirLocal?: DbSingleton; __spirRemote?: DbSingleton };
const local: DbSingleton = (g.__spirLocal ??= fresh());
const remote: DbSingleton = (g.__spirRemote ??= fresh());

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

/**
 * The time zone "today" is judged in.
 *
 * PGlite starts in GMT, and nothing set it otherwise — so in Iraq (UTC+3),
 * from midnight to 3 a.m. every `current_date` was yesterday: document dates,
 * what falls due today, and on New Year's night the year inside a document
 * number. The machine's own zone is the right answer for an app that runs on
 * the company's computers; SPIR_TIMEZONE overrides it.
 */
export function workingTimeZone(): string {
  const configured = process.env.SPIR_TIMEZONE?.trim();
  if (configured) return configured;
  try {
    const machine = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (machine) return machine;
  } catch {
    /* fall through */
  }
  return "Asia/Baghdad";
}

/** Put a freshly opened connection on the working time zone. */
async function applyTimeZone(pg: { query: (sql: string, params?: unknown[]) => Promise<unknown> }) {
  const tz = workingTimeZone();
  try {
    // set_config takes the zone as a bound value, so nothing is spliced into SQL.
    await pg.query("select set_config('timezone', $1, false)", [tz]);
  } catch (e) {
    console.warn(`[db] unknown time zone "${tz}", staying on GMT:`, (e as Error).message);
  }
}

async function bootPglite(): Promise<Db> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const dataDir = pgliteDataDir();
  const pg = new PGlite({
    ...(dataDir ? { dataDir } : {}),
    extensions: { pgcrypto },
    parsers: Object.fromEntries(DATE_OIDS.map((oid) => [oid, asText])),
  });
  await pg.waitReady;
  await applyTimeZone(pg);

  // Queries run as the bootstrap superuser, so RLS is bypassed (single-tenant
  // app). pgcrypto is already loaded via the constructor above.
  await initSchema(
    {
      exec: (sql) => pg.exec(sql).then(() => undefined),
      query: (sql, params) => pg.query(sql, params) as Promise<{ rows: any[] }>,
    },
    { seed: true },
  );
  local.raw = pg as unknown as PgliteHandle;
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

/**
 * Ensure the `authenticated` role, apply pending migrations, and — for the
 * local store only — seed once.
 *
 * Both ends run the migrations: the change log can only be replayed across if
 * both sides carry the same schema. Only the local store is SEEDED. Seeding
 * the peer as well would give each end its own rows for the same starter
 * data, with different generated ids, and the first push would then collide
 * on a secondary unique key (two `devices` rows sharing an `asset_code`). The
 * peer starts empty and receives everything through sync.
 */
async function initSchema(run: Runner, opts: { seed: boolean }): Promise<void> {
  // RLS policies reference the "authenticated" role — it must exist. On a hosted
  // Supabase database it already does, so the guard simply no-ops.
  await run.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;`);

  // Migrations must not enter the change log. Every node applies the same
  // migration files itself, so their effects are already present on both
  // ends — logging them would push a rename of shared master data onto a
  // peer that already renamed its own copy, and collide on the unique name
  // because the two ends generated different ids for those seeded rows.
  // The seed is different and IS logged: only this node has it, and the peer
  // gets it by sync.
  await run.exec(`select set_config('spir.syncing', 'on', false)`).catch(() => undefined);
  try {
    await applyPendingMigrations(run);

    // Re-attach the change-log triggers after every migration run, so a table
    // added by a later migration is covered without anyone having to remember.
    // Guarded because a database that predates migration 0089 has not defined
    // the function yet at this point on its very first upgrade pass.
    await run
      .exec(`do $$ begin
        if to_regprocedure('_spir_attach_change_log()') is not null then
          perform _spir_attach_change_log();
        end if;
      end $$;`)
      .catch(() => undefined);
    // Likewise, a trigger added by a later migration must not fire again on
    // a change that arrives by sync (migration 0106).
    await run
      .exec(`do $$ begin
        if to_regprocedure('_spir_guard_triggers()') is not null then
          perform _spir_guard_triggers();
        end if;
      end $$;`)
      .catch(() => undefined);
  } finally {
    // This connection goes on to serve the app, so the flag must come back
    // off whatever happened above — otherwise no write would ever be logged.
    await run.exec(`select set_config('spir.syncing', 'off', false)`).catch(() => undefined);
  }

  // Seed runs exactly once, on a genuinely fresh database, gated by the
  // `_spir_meta` marker — so redeploys and migration top-ups never re-seed.
  const seeded = await run.query<{ n: number }>(
    `select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='_spir_meta'`
  );
  if ((seeded.rows[0]?.n ?? 0) === 0) {
    if (opts.seed) {
      const file = seedFile();
      if (file) await run.exec(fs.readFileSync(file, "utf8"));
    }
    await run.exec(`create table if not exists _spir_meta (k text primary key);
      insert into _spir_meta(k) values ('bootstrapped') on conflict do nothing;`);
  }
}

// ---- hosted Postgres backend (node-postgres) ------------------------------

/**
 * True for an address that goes through a transaction pooler (Supabase's
 * port 6543, or pgbouncer's `pool_mode=transaction` hint). Such a pooler may
 * hand each statement to a different server connection, and the migrator
 * needs one connection throughout: its advisory lock taken on one and
 * released on another stays held forever, and every later machine's first
 * contact then waits on it. The session pooler (5432) and a direct
 * connection keep one connection, and work.
 */
export function isTransactionPooler(url: string): boolean {
  try {
    const u = new URL(url);
    return u.port === "6543" || /pool_?mode=transaction/i.test(u.search);
  } catch {
    return false;
  }
}

async function bootPostgres(url: string): Promise<Db> {
  if (isTransactionPooler(url)) {
    throw new Error(
      "The hosted database address uses a transaction pooler (port 6543). Use the session pooler (port 5432) or the direct connection.",
    );
  }
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
      await initSchema(
        {
          exec: (sql) => client.query(sql).then(() => undefined),
          query: (sql, params) => client.query(sql, params as any[]).then((r) => ({ rows: r.rows })),
        },
        { seed: false },
      );
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

/**
 * The hosted database to sync with, or null when there is none.
 *
 * `DATABASE_URL` wins when it is set, so a server deployed with one keeps
 * behaving exactly as it was deployed and nothing in the UI can override it.
 * Otherwise the value saved from Settings is used, which is what lets a
 * company attach a hosted database later without touching the environment.
 */
export async function remoteUrl(): Promise<string | null> {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return fromEnv;
  try {
    const { db } = await getDb();
    const r = await db.query<{ database_url: string | null }>(
      `select database_url from _spir_peer`,
    );
    return r.rows[0]?.database_url || null;
  } catch {
    // A database too old to have the table, or not open yet.
    return null;
  }
}

/** True when a hosted database is configured to sync with. */
export async function isRemoteConfigured(): Promise<boolean> {
  return (await remoteUrl()) !== null;
}

/** Set (or, with null, clear) the hosted database this machine syncs to. */
export async function setRemoteUrl(url: string | null): Promise<void> {
  const { db } = await getDb();
  await db.query(
    `insert into _spir_peer (only_row, database_url, updated_at) values (true, $1, now())
     on conflict (only_row) do update set database_url = excluded.database_url, updated_at = now()`,
    [url],
  );
  // Whatever pool we had points at the old address.
  resetRemoteDb();
}

/** Whether the address came from the environment, so the UI can say so. */
export function remoteUrlIsFromEnvironment(): boolean {
  return !!process.env.DATABASE_URL;
}

async function bootLocal(): Promise<{ db: Db; meta: FkMeta }> {
  const db = await bootPglite();
  return { db, meta: await introspect(db) };
}

/**
 * The working store. Always the embedded database, so this resolves with no
 * configuration, no network, and no hosted database in existence.
 */
export async function getDb(): Promise<{ db: Db; meta: FkMeta }> {
  if (local.dbRef && local.fkMeta) return { db: local.dbRef, meta: local.fkMeta };
  // On failure clear the promise so the next request retries rather than
  // caching a rejected boot forever.
  local.bootPromise ??= bootLocal().catch((e) => {
    local.bootPromise = null;
    throw e;
  });
  const res = await local.bootPromise;
  local.dbRef = res.db;
  local.fkMeta = res.meta;
  return res;
}

/**
 * The hosted peer, or null when none is configured or it cannot be reached.
 *
 * Only the sync engine calls this. It returns null instead of throwing
 * because an unreachable peer is an ordinary state for this app, not an
 * error: the company keeps working and syncs when the link comes back.
 */
export async function getRemoteDb(): Promise<Db | null> {
  const url = await remoteUrl();
  if (!url) return null;
  if (remote.dbRef) return remote.dbRef;
  remote.bootPromise ??= (async () => {
    const db = await bootPostgres(url);
    return { db, meta: await introspect(db) };
  })().catch((e) => {
    remote.bootPromise = null;
    throw e;
  });
  try {
    const res = await remote.bootPromise;
    remote.dbRef = res.db;
    remote.fkMeta = res.meta;
    return res.db;
  } catch (e) {
    console.warn("[sync] hosted database unreachable:", (e as Error).message);
    return null;
  }
}

/** Drop the cached peer so the next sync re-dials (used after a failure). */
export function resetRemoteDb(): void {
  remote.dbRef = null;
  remote.fkMeta = null;
  remote.bootPromise = null;
}

// ---- backup and restore ---------------------------------------------------

/**
 * A complete copy of this machine's database, as a gzipped Postgres data
 * directory.
 *
 * With no hosted database configured — the default — every record the company
 * has is in one folder on one computer, so being able to take a copy of it is
 * not a convenience. Restoring is the same file going back.
 */
export async function dumpLocalDatabase(): Promise<Blob> {
  const { db } = await getDb();
  if (!local.raw) throw new Error("The local database is not open.");
  // A dump taken while first-boot migrations are still settling can fail.
  // One quiet query confirms the database is actually answering, and a
  // single retry covers the moment in between.
  await db.query("select 1");
  // Dumping while the engine is still busy with an earlier request fails, and
  // it has been seen to fail twice in a row under load. A backup is the one
  // thing that must not quietly give up, so try a few times with a widening
  // pause and surface the real reason if they all fail.
  let last: unknown;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await local.raw.dumpDataDir();
    } catch (e) {
      last = e;
      console.warn(`[backup] dump attempt ${attempt} failed:`, (e as Error).message);
      await new Promise((r) => setTimeout(r, attempt * 750));
      await db.query("select 1").catch(() => undefined);
    }
  }
  throw last;
}

/**
 * Replace this machine's database with a backup.
 *
 * The running instance is closed and reopened over the SAME data directory
 * with the dump loaded, so the restored data is on disk and no restart is
 * needed. If reopening fails the singleton is cleared rather than left
 * pointing at a closed connection, so the next request re-boots cleanly.
 *
 * This replaces everything, including the change log — so after a restore
 * this machine's sync cursors describe the backup's history, not the history
 * of whatever was here before. A peer will resend anything it holds that the
 * restored copy is missing.
 */
export async function restoreLocalDatabase(dump: Blob): Promise<void> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { pgcrypto } = await import("@electric-sql/pglite/contrib/pgcrypto");
  const dataDir = pgliteDataDir();

  // Close the live instance first: it holds the data directory open.
  if (local.raw) await local.raw.close().catch(() => undefined);
  local.dbRef = null;
  local.fkMeta = null;
  local.bootPromise = null;
  local.raw = null;

  if (dataDir) fs.rmSync(dataDir, { recursive: true, force: true });

  const pg = await PGlite.create({
    ...(dataDir ? { dataDir } : {}),
    loadDataDir: dump,
    extensions: { pgcrypto },
    parsers: Object.fromEntries(DATE_OIDS.map((oid) => [oid, asText])),
  });
  await pg.waitReady;
  await applyTimeZone(pg);

  // A backup may predate migrations this build carries, so bring it forward
  // before anything queries it.
  await initSchema(
    {
      exec: (sql) => pg.exec(sql).then(() => undefined),
      query: (sql, params) => pg.query(sql, params) as Promise<{ rows: any[] }>,
    },
    { seed: false },
  );

  const db = pg as unknown as Db;
  local.raw = pg as unknown as PgliteHandle;
  local.dbRef = db;
  local.fkMeta = await introspect(db);
  local.bootPromise = Promise.resolve({ db, meta: local.fkMeta });
}
