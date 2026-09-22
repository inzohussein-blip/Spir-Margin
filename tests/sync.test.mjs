// Sync: two independent databases running the same migrations must converge
// through the change log, in both directions, without echoing changes back.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

/** Minimal stand-in for the engine's `Db`, over a PGlite handle. */
const wrap = (pg) => ({
  query: (sql, params = []) => pg.query(sql, params),
});

const PEER = "remote";
const BATCH = 200;

async function nodeId(db) {
  return (await db.query(`select _spir_node_id() as n`)).rows[0].n;
}

async function cursors(db) {
  await db.query(`insert into _spir_sync_state (peer) values ($1) on conflict (peer) do nothing`, [PEER]);
  const r = await db.query(`select pushed_through, pulled_through from _spir_sync_state where peer=$1`, [PEER]);
  return { pushed: r.rows[0]?.pushed_through ?? "0", pulled: r.rows[0]?.pulled_through ?? "0" };
}

const applyOne = (target, c) =>
  target.query(`select _spir_apply_change($1,$2,$3::jsonb,$4::jsonb,$5::timestamptz,$6::uuid)`, [
    c.table_name, c.op, JSON.stringify(c.pk),
    c.row === null ? null : JSON.stringify(c.row), c.changed_at, c.origin,
  ]);

async function push(local, peer, me, from) {
  let cursor = from, total = 0;
  for (;;) {
    const b = await local.query(
      `select seq, origin, origin_seq, table_name, op, pk, row, changed_at from _spir_changes
        where origin=$1 and seq>$2 order by seq limit ${BATCH}`, [me, cursor]);
    if (b.rows.length === 0) break;
    for (const c of b.rows) {
      await applyOne(peer, c);
      await peer.query(
        `insert into _spir_changes (origin, origin_seq, table_name, op, pk, row, changed_at)
         values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) on conflict (origin, origin_seq) do nothing`,
        [c.origin, c.origin_seq, c.table_name, c.op, JSON.stringify(c.pk),
         c.row === null ? null : JSON.stringify(c.row), c.changed_at]);
      cursor = c.seq; total++;
    }
    await local.query(`update _spir_sync_state set pushed_through=$2 where peer=$1`, [PEER, cursor]);
    if (b.rows.length < BATCH) break;
  }
  return total;
}

async function pull(local, peer, me, from) {
  let cursor = from, total = 0;
  for (;;) {
    const b = await peer.query(
      `select seq, origin, origin_seq, table_name, op, pk, row, changed_at from _spir_changes
        where seq>$1 order by seq limit ${BATCH}`, [cursor]);
    if (b.rows.length === 0) break;
    for (const c of b.rows) {
      if (c.origin !== me) { await applyOne(local, c); total++; }
      cursor = c.seq;
    }
    await local.query(`update _spir_sync_state set pulled_through=$2 where peer=$1`, [PEER, cursor]);
    if (b.rows.length < BATCH) break;
  }
  return total;
}

async function sync(local, peer) {
  const me = await nodeId(local);
  const { pushed, pulled } = await cursors(local);
  const sent = await push(local, peer, me, pushed);
  const got = await pull(local, peer, me, pulled);
  return { sent, got };
}

test("every table with a primary key is covered by the change log", async () => {
  const db = wrap(await bootWithMigrations());
  const { rows } = await db.query(`
    select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r'
       and left(c.relname,5) <> '_spir'
       and c.relname not in ('audit_log','app_errors','login_attempts',
                             'connectivity_events','sync_events','idempotency_keys')
       and exists (select 1 from pg_index i where i.indrelid=c.oid and i.indisprimary)
       and not exists (select 1 from pg_trigger t
                        where t.tgrelid=c.oid and t.tgname='zz_spir_change_log')
     order by 1`);
  assert.deepEqual(rows.map((r) => r.relname), []);
});

test("local work reaches the hosted peer", async () => {
  const a = wrap(await bootWithMigrations());
  const hub = wrap(await bootWithMigrations());

  await a.query(`insert into labs (code, name, city) values ('L-A','مختبر ألف','بغداد')`);
  const res = await sync(a, hub);
  assert.ok(res.sent >= 1, `expected changes to be pushed, got ${res.sent}`);

  const r = await hub.query(`select name, city from labs where code='L-A'`);
  assert.equal(r.rows.length, 1, "the lab should exist on the peer");
  assert.equal(r.rows[0].name, "مختبر ألف");
});

test("a second machine pulls what the first one wrote", async () => {
  const a = wrap(await bootWithMigrations());
  const b = wrap(await bootWithMigrations());
  const hub = wrap(await bootWithMigrations());

  await a.query(`insert into labs (code, name) values ('L-SHARED','مختبر مشترك')`);
  await sync(a, hub);
  const res = await sync(b, hub);

  assert.ok(res.got >= 1, `b should have pulled changes, got ${res.got}`);
  const r = await b.query(`select name from labs where code='L-SHARED'`);
  assert.equal(r.rows.length, 1, "the lab should have reached the second machine");
  assert.equal(r.rows[0].name, "مختبر مشترك");
});

test("updates and deletes travel too", async () => {
  const a = wrap(await bootWithMigrations());
  const b = wrap(await bootWithMigrations());
  const hub = wrap(await bootWithMigrations());

  await a.query(`insert into labs (code, name) values ('L-EDIT','الاسم الأول')`);
  await sync(a, hub);
  await sync(b, hub);

  await a.query(`update labs set name='الاسم الثاني' where code='L-EDIT'`);
  await sync(a, hub);
  await sync(b, hub);
  assert.equal(
    (await b.query(`select name from labs where code='L-EDIT'`)).rows[0].name,
    "الاسم الثاني",
  );

  await a.query(`delete from labs where code='L-EDIT'`);
  await sync(a, hub);
  await sync(b, hub);
  assert.equal((await b.query(`select 1 from labs where code='L-EDIT'`)).rows.length, 0);
});

test("applying a pulled change does not echo it back", async () => {
  const a = wrap(await bootWithMigrations());
  const b = wrap(await bootWithMigrations());
  const hub = wrap(await bootWithMigrations());

  await a.query(`insert into labs (code, name) values ('L-ECHO','صدى')`);
  await sync(a, hub);
  await sync(b, hub);

  // b applied a's change; that must not have entered b's own log.
  const meB = await nodeId(b);
  const own = await b.query(`select count(*)::int n from _spir_changes where origin=$1`, [meB]);
  assert.equal(own.rows[0].n, 0, "an applied change must not be logged as local work");

  // And a second pass moves nothing in either direction.
  const again = await sync(b, hub);
  assert.equal(again.sent, 0);
  assert.equal(again.got, 0);
});

test("syncing twice is a no-op, and re-pushing lands once", async () => {
  const a = wrap(await bootWithMigrations());
  const hub = wrap(await bootWithMigrations());

  await a.query(`insert into labs (code, name) values ('L-ONCE','مرة واحدة')`);
  await sync(a, hub);
  const second = await sync(a, hub);
  assert.equal(second.sent, 0, "nothing new to push");

  const n = await hub.query(`select count(*)::int n from labs where code='L-ONCE'`);
  assert.equal(n.rows[0].n, 1);
});

test("the last writer wins on a conflicting row", async () => {
  const a = wrap(await bootWithMigrations());
  const b = wrap(await bootWithMigrations());
  const hub = wrap(await bootWithMigrations());

  await a.query(`insert into labs (code, name) values ('L-CONF','الأصل')`);
  await sync(a, hub);
  await sync(b, hub);

  // Both edit the same row while apart; a syncs first, then b.
  await a.query(`update labs set name='تعديل ألف' where code='L-CONF'`);
  await b.query(`update labs set name='تعديل باء' where code='L-CONF'`);
  await sync(a, hub);
  await sync(b, hub);
  await sync(a, hub);

  const onHub = (await hub.query(`select name from labs where code='L-CONF'`)).rows[0].name;
  const onA = (await a.query(`select name from labs where code='L-CONF'`)).rows[0].name;
  const onB = (await b.query(`select name from labs where code='L-CONF'`)).rows[0].name;
  assert.equal(onHub, "تعديل باء", "the later writer should win on the peer");
  assert.equal(onA, onHub, "a should converge on the peer's value");
  assert.equal(onB, onHub, "b should converge on the peer's value");
});

test("a multi-row document survives the trip intact", async () => {
  const a = wrap(await bootWithMigrations());
  const b = wrap(await bootWithMigrations());
  const hub = wrap(await bootWithMigrations());

  const lab = (await a.query(
    `insert into labs (code, name) values ('L-DOC','مختبر الفاتورة') returning id`)).rows[0].id;
  const prod = (await a.query(
    `insert into products (item_code, name, product_type) values ('P-DOC','منتج','spare_part') returning id`
  )).rows[0].id;
  await a.query(
    `insert into sales (lab_id, product_id, qty, buy_price, sell_price, sold_at)
     values ($1,$2,3,1000,1500,current_date)`, [lab, prod]);

  await sync(a, hub);
  await sync(b, hub);

  const r = await b.query(
    `select s.qty, s.sell_price, l.name as lab, p.name as product
       from sales s join labs l on l.id=s.lab_id join products p on p.id=s.product_id
      where l.code='L-DOC'`);
  assert.equal(r.rows.length, 1, "the sale and both its parents should have arrived");
  assert.equal(Number(r.rows[0].qty), 3);
  assert.equal(r.rows[0].lab, "مختبر الفاتورة");
  assert.equal(r.rows[0].product, "منتج");
});

test("the order machines sync in does not change the result", async () => {
  // The same two edits, replayed with the sync passes in the opposite order,
  // must land on the same value everywhere. Ordering by arrival at the peer
  // fails this; the row-version register is what makes it hold.
  const outcome = async (aFirst) => {
    const a = wrap(await bootWithMigrations());
    const b = wrap(await bootWithMigrations());
    const hub = wrap(await bootWithMigrations());

    await a.query(`insert into labs (code, name) values ('L-ORD','الأصل')`);
    await sync(a, hub);
    await sync(b, hub);

    await a.query(`update labs set name='من ألف' where code='L-ORD'`);
    await new Promise((r) => setTimeout(r, 5));
    await b.query(`update labs set name='من باء' where code='L-ORD'`);

    for (const n of aFirst ? [a, b, a, b] : [b, a, b, a]) await sync(n, hub);

    const read = async (db) => (await db.query(`select name from labs where code='L-ORD'`)).rows[0].name;
    return { a: await read(a), b: await read(b), hub: await read(hub) };
  };

  const first = await outcome(true);
  const second = await outcome(false);
  assert.equal(first.a, first.b, "a and b should agree");
  assert.equal(first.a, first.hub, "and agree with the peer");
  assert.deepEqual(first, second, "syncing in the other order must reach the same value");
  assert.equal(first.hub, "من باء", "the later edit should win");
});

test("migrations do not enter the change log", async () => {
  // Every node applies the same migration files itself, so a migration that
  // edits data — 0087 and 0090 rename master data — must not be logged and
  // pushed. It would land on a peer that already made the same change to its
  // own copy, and collide on the unique name because the two ends generated
  // different ids for those seeded rows. This caught exactly that.
  const db = wrap(await bootWithMigrations());
  const { rows } = await db.query(`select count(*)::int as n from _spir_changes`);
  assert.equal(rows[0].n, 0, "a freshly migrated database should have an empty change log");
});

test("master data renamed by a migration does not collide on sync", async () => {
  const a = wrap(await bootWithMigrations());
  const hub = wrap(await bootWithMigrations());
  // Both ends already ran 0090, so both hold the Arabic cost centres under
  // their own ids. Syncing real work must not drag those along.
  await a.query(`insert into labs (code, name) values ('L-MIG','مختبر')`);
  const res = await sync(a, hub);
  assert.ok(res.sent >= 1);
  const n = await hub.query(`select count(*)::int as n from cost_centers where name = 'رئيسي'`);
  assert.equal(n.rows[0].n, 1, "the peer should still hold exactly one 'رئيسي' cost centre");
});

test("an interrupted push resumes where it stopped, losing and duplicating nothing", async () => {
  // The engine claims a failure mid-run leaves the cursor at the work that
  // actually landed. Prove it: fail the peer partway through a batch, then
  // let the next pass finish.
  const a = wrap(await bootWithMigrations());
  const hubPg = await bootWithMigrations();
  const hub = wrap(hubPg);

  for (let i = 1; i <= 6; i++) {
    await a.query(`insert into labs (code, name) values ($1, $2)`, [`L-R${i}`, `مختبر ${i}`]);
  }

  // A peer that dies after the third write of the run.
  let writes = 0;
  const flaky = {
    query: (sql, params = []) => {
      if (/insert into _spir_changes|_spir_apply_change/.test(sql) && ++writes > 6) {
        throw new Error("connection lost");
      }
      return hubPg.query(sql, params);
    },
  };

  await assert.rejects(() => sync(a, flaky), /connection lost/);

  const landed = Number((await hub.query(`select count(*)::int n from labs where code like 'L-R%'`)).rows[0].n);
  assert.ok(landed > 0 && landed < 6, `expected a partial push, got ${landed}`);

  // The peer recovers. The cursor sits before the batch that died, so the
  // next pass replays it — deliberately, since a cursor write per row would
  // cost a round trip per change and replaying costs nothing.
  const res = await sync(a, hub);
  assert.ok(res.sent >= 6 - landed, `the remainder must go, got ${res.sent}`);

  const rows = await hub.query(`select code, count(*)::int n from labs where code like 'L-R%' group by code order by code`);
  assert.equal(rows.rows.length, 6, "all six should be there");
  assert.ok(rows.rows.every((r) => r.n === 1), "and none duplicated");

  // And a further pass moves nothing at all.
  assert.deepEqual(await sync(a, hub), { sent: 0, got: 0 });
});

test("the change log keeps one month of pushed changes", async () => {
  const a = wrap(await bootWithMigrations());
  const hub = wrap(await bootWithMigrations());

  await a.query(`insert into labs (code, name) values ('L-KEEP','يبقى')`);
  await a.query(`insert into labs (code, name) values ('L-GONE','يُحذف')`);
  await sync(a, hub);

  // Age one of them past the window; both are already pushed.
  await a.query(
    `update _spir_changes set changed_at = now() - interval '45 days' where row->>'code' = 'L-GONE'`);
  const pruned = Number((await a.query(`select fn_spir_prune_changes() as n`)).rows[0].n);
  assert.equal(pruned, 1, "only the aged, already-pushed change should go");

  const left = await a.query(`select row->>'code' as code from _spir_changes where table_name='labs'`);
  assert.deepEqual(left.rows.map((r) => r.code), ["L-KEEP"]);

  // The rows themselves are untouched — this prunes history, not data.
  const labs = await a.query(`select count(*)::int n from labs where code in ('L-KEEP','L-GONE')`);
  assert.equal(labs.rows[0].n, 2, "pruning the log must not touch the records");

  // And the register last-writer-wins depends on survives.
  const ver = await a.query(`select count(*)::int n from _spir_row_version where table_name='labs'`);
  assert.ok(ver.rows[0].n >= 2, "row versions must outlive the pruned log");
});

test("an unsent change is never pruned, however old", async () => {
  const a = wrap(await bootWithMigrations());
  // Nothing has been pushed, so nothing is eligible — this is the machine
  // with no hosted database, where the log is the only record of the work.
  await a.query(`insert into labs (code, name) values ('L-UNSENT','لم يُرسل')`);
  await a.query(`update _spir_changes set changed_at = now() - interval '400 days'`);
  const pruned = Number((await a.query(`select fn_spir_prune_changes() as n`)).rows[0].n);
  assert.equal(pruned, 0);
  const n = await a.query(`select count(*)::int n from _spir_changes where row->>'code'='L-UNSENT'`);
  assert.equal(n.rows[0].n, 1);
});

test("a refused change is recorded, not forgotten", async () => {
  const a = wrap(await bootWithMigrations());
  const hubPg = await bootWithMigrations();
  const hub = wrap(hubPg);

  await a.query(`insert into labs (code, name) values ('L-OK','مقبول')`);
  await a.query(`insert into labs (code, name) values ('L-BAD','مرفوض')`);

  // A peer that refuses one specific record and accepts the rest.
  const picky = {
    query: async (sql, params = []) => {
      if (/_spir_apply_change/.test(sql) && JSON.stringify(params).includes("L-BAD")) {
        throw new Error("check constraint violated");
      }
      return hubPg.query(sql, params);
    },
  };

  // Push by hand so the refusal goes through the engine's own bookkeeping.
  const me = await nodeId(a);
  const { pushed } = await cursors(a);
  const batch = await a.query(
    `select seq, origin, origin_seq, table_name, op, pk, row, changed_at from _spir_changes
      where origin=$1 and seq>$2 order by seq`, [me, pushed]);
  for (const c of batch.rows) {
    try {
      await applyOne(picky, c);
      await a.query(`select fn_spir_clear_reject('push',$1,$2::jsonb)`, [c.table_name, JSON.stringify(c.pk)]);
    } catch (e) {
      await a.query(`select fn_spir_note_reject('push',$1,$2::jsonb,$3,$4)`,
        [c.table_name, JSON.stringify(c.pk), c.op, e.message]);
    }
  }

  // The good one landed; the bad one is on the record rather than lost.
  assert.equal(
    Number((await hub.query(`select count(*)::int n from labs where code='L-OK'`)).rows[0].n), 1,
    "the accepted change should still get through");
  const open = await a.query(
    `select table_name, attempts, error from _spir_sync_rejects where resolved_at is null`);
  assert.equal(open.rows.length, 1, "the refusal should be recorded");
  assert.equal(open.rows[0].table_name, "labs");
  assert.match(open.rows[0].error, /check constraint/);

  // And once it finally gets across, it stops being listed.
  const bad = batch.rows.find((c) => JSON.stringify(c.row).includes("L-BAD"));
  await applyOne(hub, bad);
  await a.query(`select fn_spir_clear_reject('push',$1,$2::jsonb)`,
    [bad.table_name, JSON.stringify(bad.pk)]);
  const after = await a.query(`select count(*)::int n from _spir_sync_rejects where resolved_at is null`);
  assert.equal(after.rows[0].n, 0, "a change that gets through should clear its rejection");
});
