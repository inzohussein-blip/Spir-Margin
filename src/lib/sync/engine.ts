import "server-only";
import { getDb, getRemoteDb, resetRemoteDb, type Db } from "@/lib/db/pglite";
import {
  cursors,
  dbPeer,
  noteError,
  nodeId,
  pendingCount,
  syncOnce,
  type SyncPeer,
  type SyncResult,
} from "./core";
import { decodeSyncCode, type LanCode } from "./code";
import { lanPeer, UnreachableError, WrongCodeError } from "./lan";

export type { SyncResult } from "./core";

/**
 * Offline-first sync, for the program.
 *
 * The embedded database on this machine is the store. It may have one
 * upstream to sync with:
 *
 *   the hosted database   — reached directly (DATABASE_URL, or the address
 *                           saved on the Sync page); how branches meet.
 *   the main computer     — another install on the office network, reached
 *                           with its sync code; it passes the office's work on
 *                           to the hosted database if it has one.
 *
 * The algorithm is in ./core; this file picks the peer and keeps the
 * bookkeeping. Nothing here is on the request path. If the peer is missing,
 * unreachable or half-broken, the company keeps working on the local
 * database and the next run carries on.
 */

export type UpstreamKind = "hosted" | "lan";

export interface Upstream {
  kind: UpstreamKind;
  /** The cursor row in _spir_sync_state, and the tag on what arrives from it. */
  key: "remote" | "lan";
  /** Something to show: host/database, or the main computer's name. */
  label: string;
  lan?: LanCode;
}

export interface SyncStatus {
  /** An upstream is configured. */
  configured: boolean;
  kind: UpstreamKind | null;
  label: string | null;
  /** The peer answered on the last attempt. */
  reachable: boolean;
  /** Changes here not yet accepted by the peer. */
  pending: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

/** The upstream this computer syncs with, if any. Never throws. */
export async function upstream(): Promise<Upstream | null> {
  // The public demo on Vercel runs on demo records in memory. Syncing it
  // with a real database would pour those records into the company's, and
  // expose the company's to anyone with the demo's published password.
  if (process.env.VERCEL && (process.env.SPIR_SEED === "demo" || process.env.SPIR_SEED === "full")) return null;
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv) return { kind: "hosted", key: "remote", label: hostLabel(fromEnv) };
  try {
    const { db } = await getDb();
    const r = await db.query<{ database_url: string | null; lan_code: string | null }>(
      `select database_url, lan_code from _spir_peer`,
    );
    const row = r.rows[0];
    if (row?.lan_code) {
      const code = decodeSyncCode(row.lan_code);
      if (code?.k === "lan") return { kind: "lan", key: "lan", label: code.c || code.a[0], lan: code };
    }
    if (row?.database_url) return { kind: "hosted", key: "remote", label: hostLabel(row.database_url) };
  } catch {
    /* a database too old to have the columns, or not open yet */
  }
  return null;
}

export function hostLabel(url: string): string {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, "");
    return db ? `${u.host}/${db}` : u.host;
  } catch {
    return "…";
  }
}

async function state(db: Db, key: string) {
  const s = await db.query<{ last_sync_at: string | null; last_error: string | null }>(
    `select last_sync_at, last_error from _spir_sync_state where peer = $1`,
    [key],
  );
  return s.rows[0] ?? { last_sync_at: null, last_error: null };
}

/** Where sync stands right now, without touching the network. */
export async function syncStatus(): Promise<SyncStatus> {
  const up = await upstream();
  const { db } = await getDb();
  const key = up?.key ?? "remote";
  const s = await state(db, key);
  return {
    configured: !!up,
    kind: up?.kind ?? null,
    label: up?.label ?? null,
    reachable: !!up && !s.last_error,
    pending: await pendingCount(db, key),
    lastSyncAt: s.last_sync_at,
    lastError: s.last_error,
  };
}

/** Everything `/monitoring/sync` needs about database sync, in one read. */
export interface SyncDetail extends SyncStatus {
  /** Changes this machine has recorded since it was set up. */
  logged: number;
  /** When the oldest not-yet-sent change was made. */
  oldestPending: string | null;
  /** What is still only on this machine, oldest first. */
  waiting: { table: string; op: "I" | "U" | "D"; at: string }[];
}

export async function syncDetail(limit = 25): Promise<SyncDetail> {
  const base = await syncStatus();
  const { db } = await getDb();
  const me = await nodeId(db);
  const key = (await upstream())?.key ?? "remote";
  const { pushed } = await cursors(db, key);

  const total = await db.query<{ n: string }>(
    `select count(*)::text as n from _spir_changes where origin = $1`,
    [me],
  );
  const rows = await db.query<{ table_name: string; op: "I" | "U" | "D"; changed_at: string }>(
    `select table_name, op, changed_at
       from _spir_changes
      where seq > $1 and received_from is distinct from $2
      order by seq
      limit ${Math.max(1, Math.min(limit, 200))}`,
    [pushed, key],
  );

  return {
    ...base,
    logged: Number(total.rows[0]?.n ?? 0),
    oldestPending: rows.rows[0]?.changed_at ?? null,
    waiting: rows.rows.map((r) => ({ table: r.table_name, op: r.op, at: r.changed_at })),
  };
}

async function peerFor(up: Upstream): Promise<SyncPeer | null> {
  if (up.kind === "lan") {
    if (!up.lan) return null;
    const { db } = await getDb();
    return lanPeer(up.lan, await nodeId(db));
  }
  const db = await getRemoteDb();
  return db ? dbPeer(db, "remote") : null;
}

// One pass at a time: the page's timer, the background timer and the "Sync
// now" button can all ask at once, and two passes would send the same batch
// twice. The later callers get the running pass's result.
const G = globalThis as unknown as { __spirSyncRun?: { run: Promise<SyncResult>; since: number } | null };

// A pass that has not finished in this long is taken to be stuck (a link
// that died without saying so), and no longer holds everyone else back.
const STUCK_MS = 10 * 60_000;

/**
 * Run one sync pass. Safe to call at any time: with no upstream it reports
 * that and does nothing, and a failure part-way leaves the cursors at the
 * last completed batch, which the next run simply replays.
 */
export function runSync(): Promise<SyncResult> {
  const current = G.__spirSyncRun;
  if (current && Date.now() - current.since < STUCK_MS) return current.run;
  if (current) {
    console.warn("[sync] the previous pass has not finished in 10 minutes; starting a new one");
    resetRemoteDb();
  }
  const entry = { run: Promise.resolve() as unknown as Promise<SyncResult>, since: Date.now() };
  entry.run = runOnce().finally(() => {
    if (G.__spirSyncRun === entry) G.__spirSyncRun = null;
  });
  G.__spirSyncRun = entry;
  return entry.run;
}

async function runOnce(): Promise<SyncResult> {
  const up = await upstream();
  if (!up) return { ok: false, pushed: 0, pulled: 0, error: "Nothing to sync with is configured" };

  const { db: local } = await getDb();
  const unreachable =
    up.kind === "lan" ? "The main computer could not be reached" : "The hosted database could not be reached";
  const peer = await peerFor(up);
  if (!peer) {
    await noteError(local, up.key, unreachable);
    return { ok: false, pushed: 0, pulled: 0, error: unreachable };
  }

  try {
    const res = await syncOnce(local, peer);
    if (res.error) console.warn("[sync]", res.error);
    return res;
  } catch (e) {
    let msg = (e as Error).message;
    if (e instanceof UnreachableError) msg = unreachable;
    if (e instanceof WrongCodeError) msg = "The main computer did not accept this sync code. Link again with its current code.";
    console.error("[sync] failed:", (e as Error).message);
    // Drop the pooled peer so the next attempt re-dials rather than reusing a
    // connection that may be the reason this failed.
    if (up.kind === "hosted") resetRemoteDb();
    await noteError(local, up.key, msg);
    return { ok: false, pushed: 0, pulled: 0, error: msg };
  }
}

export interface SyncReject {
  id: string;
  direction: "push" | "pull";
  table: string;
  op: "I" | "U" | "D";
  error: string;
  attempts: number;
  lastSeen: string;
}

/** Changes the far end is still refusing. */
export async function listRejects(limit = 50): Promise<SyncReject[]> {
  const { db } = await getDb();
  const r = await db
    .query<{
      id: string; direction: "push" | "pull"; table_name: string;
      op: "I" | "U" | "D"; error: string; attempts: number; last_seen: string;
    }>(
      `select id::text, direction, table_name, op, error, attempts, last_seen
         from _spir_sync_rejects
        where resolved_at is null
        order by last_seen desc
        limit ${Math.max(1, Math.min(limit, 200))}`,
    )
    .catch(() => ({ rows: [] }));
  return r.rows.map((x) => ({
    id: x.id,
    direction: x.direction,
    table: x.table_name,
    op: x.op,
    error: x.error,
    attempts: Number(x.attempts),
    lastSeen: x.last_seen,
  }));
}

/**
 * Retry a rejected change by rewinding just past it, so the next pass sends
 * it again. Only a push can be retried this way — a pull is the peer's row
 * to resend, and the next pass reads it anyway.
 */
export async function retryReject(id: string): Promise<SyncResult> {
  const { db: local } = await getDb();
  const row = await local.query<{ direction: string; table_name: string; pk: unknown }>(
    `select direction, table_name, pk from _spir_sync_rejects where id = $1::bigint and resolved_at is null`,
    [id],
  );
  const r = row.rows[0];
  if (!r) return { ok: false, pushed: 0, pulled: 0, error: "That change is no longer waiting" };

  const key = (await upstream())?.key ?? "remote";
  if (r.direction === "push") {
    await local.query(
      `update _spir_sync_state
          set pushed_through = coalesce((
              select min(seq) - 1 from _spir_changes
               where received_from is distinct from $1 and table_name = $2 and pk = $3::jsonb),
              pushed_through)
        where peer = $1`,
      [key, r.table_name, JSON.stringify(r.pk)],
    );
  }
  return runSync();
}

/** Stop tracking a rejection the company has decided not to act on. */
export async function dismissReject(id: string): Promise<void> {
  const { db } = await getDb();
  await db
    .query(`update _spir_sync_rejects set resolved_at = now() where id = $1::bigint`, [id])
    .catch(() => undefined);
}

/**
 * With nothing to sync with, nobody is waiting for this computer's log, so
 * changes older than the retention window can go (migration 0108). Without
 * this a standalone computer kept every change it ever made.
 */
export async function pruneStandalone(): Promise<void> {
  if (await upstream()) return;
  const { db } = await getDb();
  await db
    .query(`select fn_spir_prune_changes((select coalesce(max(seq), 0) from _spir_changes))`)
    .catch(() => undefined);
}

export interface SyncRename {
  table: string;
  column: string;
  oldValue: string;
  newValue: string;
  at: string;
}

/** Codes this computer renamed to settle a clash with another computer (migration 0111). */
export async function listRenames(limit = 50): Promise<SyncRename[]> {
  const { db } = await getDb();
  const r = await db
    .query<{ table_name: string; column_name: string; old_value: string; new_value: string; at: string }>(
      `select table_name, column_name, old_value, new_value, at from _spir_sync_renames
        order by at desc limit ${Math.max(1, Math.min(limit, 200))}`,
    )
    .catch(() => ({ rows: [] }));
  return r.rows.map((x) => ({ table: x.table_name, column: x.column_name, oldValue: x.old_value, newValue: x.new_value, at: x.at }));
}
