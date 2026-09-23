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
  /** For a full copy: the synced tables, and where the peer's log ends now. */
  meta?(): Promise<SnapshotMeta>;
  /** For a full copy: one page of a table's current rows, with their versions. */
  snapshot?(table: string, after: string | null): Promise<SnapshotPage>;
}

export interface SnapshotMeta {
  tables: string[];
  maxSeq: string;
}

export interface SnapshotRow {
  pk_text: string;
  pk: unknown;
  row: unknown;
  changed_at: string;
  origin: string;
}

export interface SnapshotPage {
  rows: SnapshotRow[];
  /** Where the next page starts, or null at the end of the table. */
  next: string | null;
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

// seq and origin_seq go out as text (bigint can outgrow a JS number), so
// ordering must name the table's column: a bare "order by seq" would sort
// by this text alias, and "114" would come before "5" — a child applied
// before its parent.
const COLS =
  "c.seq::text as seq, c.origin, c.origin_seq::text as origin_seq, c.table_name, c.op, c.pk, c.row, c.changed_at";

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
    `select ${COLS} from _spir_changes c
      where c.seq > $1 and c.received_from is distinct from $2
      order by c.seq limit ${Math.max(1, Math.min(limit, 500))}`,
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
    `select ${COLS}, c.received_from from _spir_changes c where c.seq > $1 order by c.seq limit ${n}`,
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

/** The tables that sync (the ones the change log watches), and the log's end. */
export async function serveMeta(db: Db): Promise<SnapshotMeta> {
  const t = await db.query<{ t: string }>(
    `select c.relname as t from pg_trigger g
       join pg_class c on c.oid = g.tgrelid
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and g.tgname = 'zz_spir_change_log'
      order by 1`,
  );
  const m = await db.query<{ s: string }>(`select coalesce(max(seq), 0)::text as s from _spir_changes`);
  return { tables: t.rows.map((r) => r.t), maxSeq: m.rows[0]?.s ?? "0" };
}

const ident = (name: string) => `"${name.replace(/"/g, '""')}"`;
const SNAPSHOT_PAGE = 300;

/**
 * One page of a table as it stands now, each row with the version the
 * row-version register holds for it. Rows with no version were made by a
 * migration, identically everywhere, and are not sent.
 */
export async function serveSnapshot(db: Db, table: string, after: string | null): Promise<SnapshotPage> {
  const meta = await serveMeta(db);
  if (!meta.tables.includes(table)) throw new Error(`not a synced table: ${table}`);
  const pk = await db.query<{ a: string }>(
    `select a.attname as a
       from pg_index i
       join lateral unnest(i.indkey) with ordinality k(attnum, ord) on true
       join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
      where i.indrelid = $1::regclass and i.indisprimary
      order by k.ord`,
    [`public.${ident(table)}`],
  );
  const cols = pk.rows.map((r) => r.a);
  const r = await db.query<SnapshotRow>(
    `select v.pk_text, x.pk, x.row, v.changed_at, v.origin::text as origin
       from (select to_jsonb(t) as row,
                    (select jsonb_object_agg(k, to_jsonb(t) -> k) from unnest($2::text[]) k) as pk
               from public.${ident(table)} t) x
       join _spir_row_version v on v.table_name = $1 and v.pk_text = x.pk::text
      where $3::text is null or v.pk_text > $3::text
      order by v.pk_text
      limit ${SNAPSHOT_PAGE}`,
    [table, cols, after],
  );
  return { rows: r.rows, next: r.rows.length === SNAPSHOT_PAGE ? r.rows[r.rows.length - 1].pk_text : null };
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
    meta: () => serveMeta(peer),
    snapshot: (table, after) => serveSnapshot(peer, table, after),
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
  let { pulled } = await cursors(local, peer.key);
  const rejected: string[] = [];
  let copied = 0;

  // Has the peer pruned past where this computer stopped reading — a long
  // absence, or a first contact with a peer whose log no longer starts at
  // the beginning? Then the log alone would leave records out: take the
  // peer's current rows first, then read the log from where it stood.
  // (With a complete log the log is read as usual, and every row lands in
  // this computer's log too, to pass on.)
  const probe = await peer.pull(pulled, me);
  const gap = probe.oldest !== null && Number(pulled) < Number(probe.oldest) - 1;
  if (gap && peer.meta && peer.snapshot) {
    const res = await snapshotFrom(local, peer, rejected);
    copied = res.applied;
    pulled = res.mark;
    await local.query(`update _spir_sync_state set pulled_through = $2 where peer = $1`, [peer.key, pulled]);
  } else if (gap) {
    await noteError(local, peer.key, GAP_MESSAGE);
    return { ok: false, pushed: 0, pulled: 0, error: GAP_MESSAGE };
  }

  const pushed = await pushTo(local, peer, me, rejected);
  const pulledCount = copied + (await pullFrom(local, peer, me, pulled, rejected));

  await local.query(`select fn_spir_prune_changes()`).catch(() => undefined);

  const note = rejected.length ? `${rejected.length} change(s) were rejected — ${rejected[0]}` : null;
  await local.query(`update _spir_sync_state set last_sync_at = now(), last_error = $2 where peer = $1`, [
    peer.key,
    note,
  ]);
  return { ok: !note, pushed, pulled: pulledCount, error: note ?? undefined };
}

/** Order tables so that a table comes after the ones its foreign keys point at. */
async function parentsFirst(local: Db, tables: string[]): Promise<string[]> {
  const fk = await local.query<{ child: string; parent: string }>(
    `select c.relname as child, p.relname as parent
       from pg_constraint k
       join pg_class c on c.oid = k.conrelid
       join pg_class p on p.oid = k.confrelid
       join pg_namespace n on n.oid = c.relnamespace
      where k.contype = 'f' and n.nspname = 'public' and c.oid <> p.oid`,
  );
  const want = new Set(tables);
  const deps = new Map(tables.map((t) => [t, new Set<string>()]));
  for (const { child, parent } of fk.rows) {
    if (want.has(child) && want.has(parent)) deps.get(child)!.add(parent);
  }
  const out: string[] = [];
  const done = new Set<string>();
  while (out.length < tables.length) {
    const ready = tables.filter((t) => !done.has(t) && [...deps.get(t)!].every((d) => done.has(d)));
    // A cycle: take the rest as they come; the retry passes below sort it out.
    const next = ready.length ? ready : tables.filter((t) => !done.has(t));
    for (const t of next) {
      out.push(t);
      done.add(t);
    }
  }
  return out;
}

/**
 * Take a full copy of the peer's current rows. Each row goes through the
 * same last-writer-wins apply as a logged change, so a newer row here is
 * kept and nothing is duplicated; this works on an empty computer and on
 * one with work of its own. Rows whose parent has not arrived yet (a cycle,
 * or a parent in the same table) are retried until nothing more lands.
 */
export async function snapshotFrom(
  local: Db,
  peer: SyncPeer,
  rejected: string[],
): Promise<{ applied: number; mark: string }> {
  const meta = await peer.meta!();
  const order = await parentsFirst(local, meta.tables);
  let applied = 0;
  let waiting: ChangeRow[] = [];

  // Each copied row is also kept in this computer's log, so it reaches the
  // computers that sync through this one. It has no log entry of its own to
  // copy, so it gets a stand-in number from its version — negative, never
  // clashing with a real one — under its maker's id.
  const tryApply = async (c: ChangeRow): Promise<boolean> => {
    try {
      await applyOne(local, c);
      await local.query(
        `insert into _spir_changes (origin, origin_seq, table_name, op, pk, row, changed_at, received_from)
         values ($1, -(('x' || substr(md5($2 || ($3::jsonb)::text || $5::text), 1, 15))::bit(60)::bigint),
                 $2, 'I', $3::jsonb, $4::jsonb, $5, $6)
         on conflict (origin, origin_seq) do nothing`,
        [c.origin, c.table_name, asJson(c.pk), asJson(c.row), c.changed_at, peer.key],
      );
      return true;
    } catch {
      return false;
    }
  };

  for (const table of order) {
    let after: string | null = null;
    for (;;) {
      const page = await peer.snapshot!(table, after);
      for (const r of page.rows) {
        const c: ChangeRow = {
          seq: "0", origin: r.origin, origin_seq: "0", table_name: table, op: "I",
          pk: r.pk, row: r.row, changed_at: r.changed_at,
        };
        if (await tryApply(c)) applied++;
        else waiting.push(c);
      }
      if (!page.next) break;
      after = page.next;
    }
  }

  for (let pass = 0; pass < 5 && waiting.length; pass++) {
    const again: ChangeRow[] = [];
    for (const c of waiting) {
      if (await tryApply(c)) applied++;
      else again.push(c);
    }
    if (again.length === waiting.length) break;
    waiting = again;
  }
  for (const c of waiting) {
    try {
      await applyOne(local, c);
    } catch (e) {
      await noteRejected(local, "pull", c, (e as Error).message);
      rejected.push(`${c.table_name}: ${(e as Error).message}`);
    }
  }
  return { applied, mark: meta.maxSeq };
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
