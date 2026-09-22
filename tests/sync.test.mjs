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
