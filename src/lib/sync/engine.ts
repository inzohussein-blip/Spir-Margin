import "server-only";
import { getDb, getRemoteDb, isRemoteConfigured, resetRemoteDb, type Db } from "@/lib/db/pglite";

/**
 * Offline-first sync.
 *
 * The embedded database on this machine is the store. A hosted Postgres, when
 * `DATABASE_URL` is set, is a peer. Each database logs its own row changes
 * (migration 0089), so syncing is symmetric:
 *
 *   push — send my log rows the peer has not seen, applying each one there
 *          AND recording it in the peer's log under my node id, so a second
 *          machine can pull it later.
 *   pull — read the peer's log rows that did not originate here, and apply
 *          them locally.
 *
 * Nothing here is on the request path. If the peer is missing, unreachable or
 * half-broken, the company keeps working on the local database and the next
 * run picks up where this one stopped.
 *
 * Conflicts resolve last-writer-wins per row, which is the honest rule for a
 * single company where two people rarely edit the same record at once.
 */

const PEER = "remote";

/** Rows per round trip. Small enough to stay responsive on a poor link. */
const BATCH = 200;

export interface SyncStatus {
  /** A hosted database is configured (DATABASE_URL is set). */
  configured: boolean;
  /** The peer answered on the last attempt. */
  reachable: boolean;
  /** Local changes not yet accepted by the peer. */
  pending: number;
  lastSyncAt: string | null;
  lastError: string | null;
}

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: string;
}

interface ChangeRow {
  seq: string;
  origin: string;
  origin_seq: string;
  table_name: string;
  op: "I" | "U" | "D";
  pk: unknown;
  row: unknown;
  changed_at: string;
}

async function nodeId(db: Db): Promise<string> {
  const r = await db.query<{ n: string }>(`select _spir_node_id() as n`);
  return r.rows[0].n;
}

async function cursors(db: Db): Promise<{ pushed: string; pulled: string }> {
  await db.query(
    `insert into _spir_sync_state (peer) values ($1) on conflict (peer) do nothing`,
    [PEER],
  );
  const r = await db.query<{ pushed_through: string; pulled_through: string }>(
    `select pushed_through, pulled_through from _spir_sync_state where peer = $1`,
    [PEER],
  );
  return {
    pushed: r.rows[0]?.pushed_through ?? "0",
    pulled: r.rows[0]?.pulled_through ?? "0",
  };
}

/** Where sync stands right now, without touching the network. */
export async function syncStatus(): Promise<SyncStatus> {
  const configured = isRemoteConfigured();
  const { db } = await getDb();
  const me = await nodeId(db);
  const { pushed } = await cursors(db);
  const p = await db.query<{ n: string }>(
    `select count(*)::text as n from _spir_changes where origin = $1 and seq > $2`,
    [me, pushed],
  );
  const s = await db.query<{ last_sync_at: string | null; last_error: string | null; }>(
    `select last_sync_at, last_error from _spir_sync_state where peer = $1`,
    [PEER],
  );
  return {
    configured,
    reachable: configured && !s.rows[0]?.last_error,
    pending: Number(p.rows[0]?.n ?? 0),
    lastSyncAt: s.rows[0]?.last_sync_at ?? null,
    lastError: s.rows[0]?.last_error ?? null,
  };
}

async function applyOne(target: Db, c: ChangeRow): Promise<void> {
  await target.query(
    `select _spir_apply_change($1, $2, $3::jsonb, $4::jsonb, $5::timestamptz, $6::uuid)`,
    [
      c.table_name,
      c.op,
      JSON.stringify(c.pk),
      c.row === null ? null : JSON.stringify(c.row),
      c.changed_at,
      c.origin,
    ],
  );
}

/**
 * Send local changes the peer has not seen. Returns how many landed.
 *
 * A change the peer rejects — most often a row that violates a unique key it
 * already holds — is reported and stepped over rather than retried forever.
 * Stopping on it would wedge sync permanently and strand every later change
 * behind one bad row, which is worse for a company that just wants its work
 * to arrive.
 */
async function push(
  local: Db,
  peer: Db,
  me: string,
  from: string,
  rejected: string[],
): Promise<number> {
  let cursor = from;
  let total = 0;

  for (;;) {
    const batch = await local.query<ChangeRow>(
      `select seq, origin, origin_seq, table_name, op, pk, row, changed_at
         from _spir_changes
        where origin = $1 and seq > $2
        order by seq
        limit ${BATCH}`,
      [me, cursor],
    );
    if (batch.rows.length === 0) break;

    for (const c of batch.rows) {
      try {
        await applyOne(peer, c);
        // Record it in the peer's log under MY origin, so another machine can
        // pull it and I never pull it back. Unique on (origin, origin_seq), so
        // re-sending a batch after an interrupted run is a no-op.
        await peer.query(
          `insert into _spir_changes (origin, origin_seq, table_name, op, pk, row, changed_at)
           values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)
           on conflict (origin, origin_seq) do nothing`,
          [
            c.origin,
            c.origin_seq,
            c.table_name,
            c.op,
            JSON.stringify(c.pk),
            c.row === null ? null : JSON.stringify(c.row),
            c.changed_at,
          ],
        );
        total++;
      } catch (e) {
        rejected.push(`${c.table_name} ${JSON.stringify(c.pk)}: ${(e as Error).message}`);
      }
      cursor = c.seq;
    }

    await local.query(
      `update _spir_sync_state set pushed_through = $2 where peer = $1`,
      [PEER, cursor],
    );
    if (batch.rows.length < BATCH) break;
  }
  return total;
}

/** Apply the peer's changes that did not originate here. */
async function pull(
  local: Db,
  peer: Db,
  me: string,
  from: string,
  rejected: string[],
): Promise<number> {
  let cursor = from;
  let total = 0;

  for (;;) {
    // Read everything past the cursor, not just other nodes' rows: our own
    // pushed rows are in this log too, and the cursor has to move past them
    // or every future run would re-read them.
    const batch = await peer.query<ChangeRow>(
      `select seq, origin, origin_seq, table_name, op, pk, row, changed_at
         from _spir_changes
        where seq > $1
        order by seq
        limit ${BATCH}`,
      [cursor],
    );
    if (batch.rows.length === 0) break;

    for (const c of batch.rows) {
      if (c.origin !== me) {
        try {
          await applyOne(local, c);
          total++;
        } catch (e) {
          rejected.push(`${c.table_name} ${JSON.stringify(c.pk)}: ${(e as Error).message}`);
        }
      }
      cursor = c.seq;
    }

    await local.query(
      `update _spir_sync_state set pulled_through = $2 where peer = $1`,
      [PEER, cursor],
    );
    if (batch.rows.length < BATCH) break;
  }
  return total;
}

/**
 * Run one sync pass. Safe to call at any time: with no peer configured it
 * reports that and does nothing, and a failure mid-run leaves the cursors
 * where the work actually got to.
 */
export async function runSync(): Promise<SyncResult> {
  if (!isRemoteConfigured()) {
    return { ok: false, pushed: 0, pulled: 0, error: "No hosted database is configured" };
  }

  const { db: local } = await getDb();
  const peer = await getRemoteDb();
  if (!peer) {
    await noteError(local, "The hosted database could not be reached");
    return { ok: false, pushed: 0, pulled: 0, error: "The hosted database could not be reached" };
  }

  try {
    const me = await nodeId(local);
    const { pushed: pushFrom, pulled: pullFrom } = await cursors(local);
    // Push first so this machine's work is safe on the peer before anything
    // else is taken in. Order does not affect the outcome — the row-version
    // register makes the result the same either way — but it does mean an
    // interrupted run has already banked the local changes.
    const rejected: string[] = [];
    const pushedCount = await push(local, peer, me, pushFrom, rejected);
    const pulled = await pull(local, peer, me, pullFrom, rejected);

    // Rows the other end refused are surfaced, not swallowed: the header turns
    // amber and names the first one.
    const note = rejected.length
      ? `${rejected.length} change(s) were rejected — ${rejected[0]}`
      : null;
    if (note) console.warn("[sync]", note, `(${rejected.length} total)`);
    await local.query(
      `update _spir_sync_state set last_sync_at = now(), last_error = $2 where peer = $1`,
      [PEER, note],
    );
    return { ok: !note, pushed: pushedCount, pulled, error: note ?? undefined };
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[sync] failed:", msg);
    // Drop the pooled peer so the next attempt re-dials rather than reusing a
    // connection that may be the reason this failed.
    resetRemoteDb();
    await noteError(local, msg);
    return { ok: false, pushed: 0, pulled: 0, error: msg };
  }
}

async function noteError(local: Db, message: string): Promise<void> {
  await local
    .query(
      `insert into _spir_sync_state (peer, last_error) values ($1, $2)
       on conflict (peer) do update set last_error = excluded.last_error`,
      [PEER, message],
    )
    .catch(() => undefined);
}
