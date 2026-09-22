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
 * run carries on.
 *
 * Resumption is per BATCH, not per row: a run that dies halfway through a
 * batch leaves the cursor before it, so the next run replays that batch. That
 * is deliberate — a cursor write per row would cost a round trip per change,
 * and replaying is free of consequence because applying a change is
 * idempotent (the row-version register drops what it has already seen, and
 * the peer's log is unique on origin + origin_seq). Nothing is lost and
 * nothing lands twice; at worst a few hundred rows are re-sent.
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
  const configured = await isRemoteConfigured();
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
  const { pushed } = await cursors(db);

  const total = await db.query<{ n: string }>(
    `select count(*)::text as n from _spir_changes where origin = $1`,
    [me],
  );
  const rows = await db.query<{ table_name: string; op: "I" | "U" | "D"; changed_at: string }>(
    `select table_name, op, changed_at
       from _spir_changes
      where origin = $1 and seq > $2
      order by seq
      limit ${Math.max(1, Math.min(limit, 200))}`,
    [me, pushed],
  );

  return {
    ...base,
    logged: Number(total.rows[0]?.n ?? 0),
    oldestPending: rows.rows[0]?.changed_at ?? null,
    waiting: rows.rows.map((r) => ({ table: r.table_name, op: r.op, at: r.changed_at })),
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
        await noteResolved(local, "push", c);
      } catch (e) {
        await noteRejected(local, "push", c, (e as Error).message);
        rejected.push(`${c.table_name}: ${(e as Error).message}`);
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
          await noteResolved(local, "pull", c);
          total++;
        } catch (e) {
          await noteRejected(local, "pull", c, (e as Error).message);
          rejected.push(`${c.table_name}: ${(e as Error).message}`);
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
 * reports that and does nothing, and a failure part-way leaves the cursors at
 * the last completed batch, which the next run simply replays.
 */
export async function runSync(): Promise<SyncResult> {
  if (!(await isRemoteConfigured())) {
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
    // Has the peer pruned past where we stopped reading? Then a pull would
    // skip changes without saying so. Better to report it than to converge
    // on a quietly incomplete copy.
    const oldest = await peer.query<{ s: string | null }>(
      `select min(seq)::text as s from _spir_changes`,
    );
    if (oldest.rows[0]?.s) {
      const gap = await local.query<{ g: boolean }>(`select fn_spir_sync_gap($1::bigint) as g`, [
        oldest.rows[0].s,
      ]);
      if (gap.rows[0]?.g) {
        const msg =
          "This machine has been away longer than the hosted database keeps its history. " +
          "Restore it from a recent backup, or take a copy from a machine that is up to date.";
        await noteError(local, msg);
        return { ok: false, pushed: 0, pulled: 0, error: msg };
      }
    }

    const rejected: string[] = [];
    const pushedCount = await push(local, peer, me, pushFrom, rejected);
    const pulled = await pull(local, peer, me, pullFrom, rejected);

    // Now that the peer has accepted our changes, the old ones are safe to
    // forget. Failing to prune is never worth failing a sync over.
    await local.query(`select fn_spir_prune_changes()`).catch(() => undefined);

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

/**
 * Keep what the far end refused, so it can be looked at and retried.
 *
 * Stepping over a rejection is the right call — stopping would strand every
 * later change behind one bad row — but forgetting it is not: the two
 * databases would then differ with nothing to show for it.
 */
async function noteRejected(
  local: Db,
  direction: "push" | "pull",
  c: ChangeRow,
  error: string,
): Promise<void> {
  await local
    .query(`select fn_spir_note_reject($1, $2, $3::jsonb, $4, $5)`, [
      direction,
      c.table_name,
      JSON.stringify(c.pk),
      c.op,
      error.slice(0, 500),
    ])
    .catch(() => undefined);
}

/** A later pass got this record across, so its rejection is settled. */
async function noteResolved(local: Db, direction: "push" | "pull", c: ChangeRow): Promise<void> {
  await local
    .query(`select fn_spir_clear_reject($1, $2, $3::jsonb)`, [
      direction,
      c.table_name,
      JSON.stringify(c.pk),
    ])
    .catch(() => undefined);
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

  if (r.direction === "push") {
    const me = await nodeId(local);
    // Move the cursor back to just before this record's oldest unsent change,
    // so the normal push picks it up again along with anything after it.
    await local.query(
      `update _spir_sync_state
          set pushed_through = coalesce((
              select min(seq) - 1 from _spir_changes
               where origin = $2 and table_name = $3 and pk = $4::jsonb), pushed_through)
        where peer = 'remote'`,
      [null, me, r.table_name, JSON.stringify(r.pk)],
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
