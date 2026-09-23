/**
 * The sync algorithm, with no framework in it.
 *
 * Every computer keeps a log of row changes (migration 0089). Syncing with a
 * peer is two moves over that log:
 *
 *   push — send the peer every change it has not seen, except what came from
 *          it; the peer applies each one and records it in its own log under
 *          the ORIGINAL maker's id, so it can pass it on in turn.
 *   pull — take the peer's changes, except the ones this computer made or
 *          sent it; apply them here and record them in this log the same
 *          way, so they can be passed on too.
 *
 * Recording what passes through is what lets computers form a tree — office
 * computers → the main computer → the hosted database ← a branch — and still
 * converge: each change is kept once per database (unique on origin +
 * origin_seq), and applying it is idempotent (the row-version register
 * drops anything not newer than what is there, last writer wins).
 *
 * A peer is anything that can serve those two moves: a Postgres database
 * reached directly (the hosted database), or the main computer reached over
 * the office network. This file does not know which; the engine picks one.
 * It imports nothing, so the tests run exactly this code.
 */

export interface Db {
  query<T = any>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface ChangeRow {
  seq: string;
  origin: string;
  origin_seq: string;
  table_name: string;
  op: "I" | "U" | "D";
  pk: unknown;
  row: unknown;
  changed_at: string;
}

/** One page of a peer's log. */
export interface PullPage {
  /** The changes on this page meant for the caller. */
  rows: ChangeRow[];
  /** The last seq looked at, sent or not: where the next page starts. */
  through: string | null;
  /** Whether there is more after `through`. */
  more: boolean;
  /** The oldest seq the peer still holds, to notice a gap. */
  oldest: string | null;
}

export interface SyncPeer {
  /** Names the cursor row, and tags what arrives from this peer. */
  key: string;
  pull(after: string, me: string): Promise<PullPage>;
  /** Apply these on the peer; one entry per row: null, or why it was refused. */
  push(rows: ChangeRow[], me: string): Promise<(string | null)[]>;
}

export interface SyncResult {
  ok: boolean;
  pushed: number;
  pulled: number;
  error?: string;
}

/** Rows per round trip. Small enough to stay responsive on a poor link. */
export const BATCH = 200;

export const GAP_MESSAGE =
  "This machine has been away longer than the other side keeps its history. " +
  "Restore it from a recent backup, or take a copy from a machine that is up to date.";

const COLS = "seq::text as seq, origin, origin_seq::text as origin_seq, table_name, op, pk, row, changed_at";

export async function nodeId(db: Db): Promise<string> {
  const r = await db.query<{ n: string }>(`select _spir_node_id()::text as n`);
  return r.rows[0].n;
}

export async function cursors(db: Db, key: string): Promise<{ pushed: string; pulled: string }> {
  await db.query(`insert into _spir_sync_state (peer) values ($1) on conflict (peer) do nothing`, [key]);
  const r = await db.query<{ pushed_through: string; pulled_through: string }>(
    `select pushed_through::text as pushed_through, pulled_through::text as pulled_through
       from _spir_sync_state where peer = $1`,
    [key],
  );
  return { pushed: r.rows[0]?.pushed_through ?? "0", pulled: r.rows[0]?.pulled_through ?? "0" };
}

/** Changes here that `key` has not been sent yet. */
export async function pendingCount(db: Db, key: string): Promise<number> {
  const { pushed } = await cursors(db, key);
  const r = await db.query<{ n: string }>(
    `select count(*)::text as n from _spir_changes
      where seq > $1 and received_from is distinct from $2`,
    [pushed, key],
  );
  return Number(r.rows[0]?.n ?? 0);
}

export async function pendingRows(db: Db, key: string, limit: number): Promise<ChangeRow[]> {
  const { pushed } = await cursors(db, key);
  const r = await db.query<ChangeRow>(
    `select ${COLS} from _spir_changes
      where seq > $1 and received_from is distinct from $2
      order by seq limit ${Math.max(1, Math.min(limit, 500))}`,
    [pushed, key],
  );
  return r.rows;
}

const asJson = (v: unknown) => (v === null || v === undefined ? null : typeof v === "string" ? v : JSON.stringify(v));

async function applyOne(db: Db, c: ChangeRow): Promise<void> {
  await db.query(
    `select _spir_apply_change($1, $2, $3::jsonb, $4::jsonb, $5::timestamptz, $6::uuid)`,
    [c.table_name, c.op, asJson(c.pk), asJson(c.row), c.changed_at, c.origin],
  );
}

/** Keep a change that passed through, under its maker's id, to pass it on. */
async function record(db: Db, c: ChangeRow, receivedFrom: string | null): Promise<void> {
  await db.query(
    `insert into _spir_changes (origin, origin_seq, table_name, op, pk, row, changed_at, received_from)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
     on conflict (origin, origin_seq) do nothing`,
    [c.origin, c.origin_seq, c.table_name, c.op, asJson(c.pk), asJson(c.row), c.changed_at, receivedFrom],
  );
}

// ------------------------------------------------------------------ serving

/**
 * A page of this database's log for a caller. Skips what the caller made and
 * what it sent here — it has those — but still moves `through` past them.
 */
export async function servePull(
  db: Db,
  after: string,
  callerNode: string,
  callerTag: string | null,
  limit = BATCH,
): Promise<PullPage> {
  const n = Math.max(1, Math.min(limit, 500));
  const page = await db.query<ChangeRow & { received_from: string | null }>(
    `select ${COLS}, received_from from _spir_changes where seq > $1 order by seq limit ${n}`,
    [after],
  );
  const oldest = await db.query<{ s: string | null }>(`select min(seq)::text as s from _spir_changes`);
  const rows = page.rows
    .filter((c) => c.origin !== callerNode && (callerTag === null || c.received_from !== callerTag))
    .map(({ received_from: _drop, ...c }) => c); // eslint-disable-line @typescript-eslint/no-unused-vars
  return {
    rows,
    through: page.rows.length ? page.rows[page.rows.length - 1].seq : null,
    more: page.rows.length === n,
    oldest: oldest.rows[0]?.s ?? null,
  };
}

/** Apply changes a caller sent, and keep them to pass on. */
export async function serveAccept(db: Db, rows: ChangeRow[], callerTag: string | null): Promise<(string | null)[]> {
  const out: (string | null)[] = [];
  for (const c of rows) {
    try {
      await applyOne(db, c);
      await record(db, c, callerTag);
      out.push(null);
    } catch (e) {
      out.push((e as Error).message || "refused");
    }
  }
  return out;
}

/**
 * A Postgres database reached directly — the hosted database. It is passive:
 * it never syncs on its own, so the calling computer does both moves on it.
 */
export function dbPeer(peer: Db, key: string): SyncPeer {
  return {
    key,
    pull: (after, me) => servePull(peer, after, me, `n:${me}`),
    push: (rows, me) => serveAccept(peer, rows, `n:${me}`),
  };
}

// ------------------------------------------------------------------ syncing

async function noteRejected(db: Db, direction: "push" | "pull", c: ChangeRow, error: string) {
  await db
    .query(`select fn_spir_note_reject($1, $2, $3::jsonb, $4, $5)`, [
      direction, c.table_name, asJson(c.pk), c.op, error.slice(0, 500),
    ])
    .catch(() => undefined);
}

async function noteResolved(db: Db, direction: "push" | "pull", c: ChangeRow) {
  await db
    .query(`select fn_spir_clear_reject($1, $2, $3::jsonb)`, [direction, c.table_name, asJson(c.pk)])
    .catch(() => undefined);
}

export async function noteError(db: Db, key: string, message: string | null): Promise<void> {
  await db
    .query(
      `insert into _spir_sync_state (peer, last_error) values ($1, $2)
       on conflict (peer) do update set last_error = excluded.last_error`,
      [key, message],
    )
    .catch(() => undefined);
}

/**
 * Send what the peer has not seen. A row it refuses is recorded and stepped
 * over: stopping on it would strand every later change behind one bad row.
 */
export async function pushTo(local: Db, peer: SyncPeer, me: string, rejected: string[]): Promise<number> {
  let total = 0;
  for (;;) {
    const batch = await pendingRows(local, peer.key, BATCH);
    if (batch.length === 0) break;
    const results = await peer.push(batch, me);
    batch.forEach((c, i) => {
      const err = results[i];
      if (err) rejected.push(`${c.table_name}: ${err}`);
    });
    for (let i = 0; i < batch.length; i++) {
      if (results[i]) await noteRejected(local, "push", batch[i], results[i]!);
      else {
        total++;
        await noteResolved(local, "push", batch[i]);
      }
    }
    await local.query(`update _spir_sync_state set pushed_through = $2 where peer = $1`, [
      peer.key,
      batch[batch.length - 1].seq,
    ]);
    if (batch.length < BATCH) break;
  }
  return total;
}

/** Take what the peer has that this computer has not. */
export async function pullFrom(
  local: Db,
  peer: SyncPeer,
  me: string,
  from: string,
  rejected: string[],
): Promise<number> {
  let cursor = from;
  let total = 0;
  for (;;) {
    const page = await peer.pull(cursor, me);
    for (const c of page.rows) {
      try {
        await applyOne(local, c);
        await record(local, c, peer.key);
        await noteResolved(local, "pull", c);
        total++;
      } catch (e) {
        await noteRejected(local, "pull", c, (e as Error).message);
        rejected.push(`${c.table_name}: ${(e as Error).message}`);
      }
    }
    if (page.through === null) break;
    cursor = page.through;
    await local.query(`update _spir_sync_state set pulled_through = $2 where peer = $1`, [peer.key, cursor]);
    if (!page.more) break;
  }
  return total;
}

/**
 * One full pass with one peer: check nothing was pruned from under us, push,
 * pull, prune what the peer now safely holds, and record how it went.
 */
export async function syncOnce(local: Db, peer: SyncPeer): Promise<SyncResult> {
  const me = await nodeId(local);
  const { pulled } = await cursors(local, peer.key);

  // Has the peer pruned past where this computer stopped reading? Then a
  // pull would skip changes without saying so. Asking for an empty page
  // after the cursor costs one round trip and answers it.
  const probe = await peer.pull(pulled, me);
  if (probe.oldest !== null && Number(pulled) < Number(probe.oldest) - 1) {
    await noteError(local, peer.key, GAP_MESSAGE);
    return { ok: false, pushed: 0, pulled: 0, error: GAP_MESSAGE };
  }

  const rejected: string[] = [];
  const pushed = await pushTo(local, peer, me, rejected);
  const pulledCount = await pullFrom(local, peer, me, pulled, rejected);

  await local.query(`select fn_spir_prune_changes()`).catch(() => undefined);

  const note = rejected.length ? `${rejected.length} change(s) were rejected — ${rejected[0]}` : null;
  await local.query(`update _spir_sync_state set last_sync_at = now(), last_error = $2 where peer = $1`, [
    peer.key,
    note,
  ]);
  return { ok: !note, pushed, pulled: pulledCount, error: note ?? undefined };
}

// ------------------------------------------------------------------ joining

/** Whether this computer has any work of its own yet. */
export async function hasOwnWork(db: Db): Promise<boolean> {
  const r = await db.query<{ n: number }>(
    `select count(*)::int as n from _spir_changes where received_from is null`,
  );
  return (r.rows[0]?.n ?? 0) > 0;
}

/**
 * Turn a restored copy of the main computer's database into a computer of
 * its own. Without this the copy would BE the main computer as far as sync
 * is concerned: the same node id (so each would skip the other's changes as
 * its own), the same document-number prefix, the main computer's upstream
 * and its office-network secret.
 */
export async function adoptClone(db: Db, upstreamKey: string): Promise<void> {
  await db.query(`update _spir_node set node_id = gen_random_uuid(), created_at = now()`);
  // Everything in the copied log came from the main computer: it is not ours
  // to send back.
  await db.query(`update _spir_changes set received_from = $1`, [upstreamKey]);
  await db.query(`delete from _spir_sync_state`);
  await db.query(`delete from _spir_sync_rejects`);
  await db.query(
    `insert into _spir_sync_state (peer, pushed_through, pulled_through)
     select $1, coalesce(max(seq), 0), coalesce(max(seq), 0) from _spir_changes`,
    [upstreamKey],
  );
  await db.query(`update _spir_peer set database_url = null, lan_code = null`);
  await db.query(`update _spir_lan_server set enabled = false, secret = null`);
  await db.query(`delete from _spir_lan_clients`);
  await db.query(`update _spir_branding set doc_prefix = null`);
  await db.query(`delete from _spir_doc_counter`);
}
