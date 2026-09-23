// Sync between computers, through computers: office computers → the main
// computer → the hosted database ← a branch. Runs src/lib/sync/core.ts itself.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { bootWithMigrations, importTs } from "./helpers.mjs";

const core = await importTs("src/lib/sync/core.ts");
// Each database is a whole Postgres in memory; left open, a few tests' worth
// is enough to slow the rest to a crawl.
const open = [];
afterEach(async () => {
  await Promise.all(open.splice(0).map((pg) => pg.close().catch(() => undefined)));
});
const wrap = (pg) => {
  open.push(pg);
  return { pg, query: (sql, params = []) => pg.query(sql, params) };
};
const fresh = async () => wrap(await bootWithMigrations());

// The main computer answers office computers with exactly what it would
// answer over the network: servePull / serveAccept on its own database.
const viaMain = (main) => ({
  key: "lan",
  pull: (after, me) => core.servePull(main, after, me, `n:${me}`),
  push: (rows, me) => core.serveAccept(main, rows, `n:${me}`),
});
const viaHosted = (hosted) => core.dbPeer(hosted, "remote");

const labName = async (db, code) =>
  (await db.query(`select name from labs where code = $1`, [code])).rows[0]?.name ?? null;

async function office() {
  const [desk, main, hosted, branch] = await Promise.all([fresh(), fresh(), fresh(), fresh()]);
  const round = async () => {
    const a = await core.syncOnce(desk, viaMain(main));
    const b = await core.syncOnce(main, viaHosted(hosted));
    const c = await core.syncOnce(branch, viaHosted(hosted));
    const d = await core.syncOnce(main, viaHosted(hosted));
    const e = await core.syncOnce(desk, viaMain(main));
    return [a, b, c, d, e];
  };
  return { desk, main, hosted, branch, round };
}

test("an office computer's work reaches a branch through the main computer", async () => {
  const o = await office();
  await o.desk.query(`insert into labs (code, name) values ('L-1', 'مختبر المكتب')`);
  const results = await o.round();
  for (const r of results) assert.equal(r.ok, true, r.error);
  assert.equal(await labName(o.main, "L-1"), "مختبر المكتب");
  assert.equal(await labName(o.hosted, "L-1"), "مختبر المكتب");
  assert.equal(await labName(o.branch, "L-1"), "مختبر المكتب");
});

test("and a branch's edit comes back to the office computer", async () => {
  const o = await office();
  await o.desk.query(`insert into labs (code, name) values ('L-2', 'قبل')`);
  await o.round();
  await o.branch.query(`update labs set name = 'بعد' where code = 'L-2'`);
  await o.round();
  assert.equal(await labName(o.desk, "L-2"), "بعد");
  assert.equal(await labName(o.main, "L-2"), "بعد");
});

test("once everyone has everything, a further round moves nothing", async () => {
  const o = await office();
  await o.desk.query(`insert into labs (code, name) values ('L-3', 'ثالث')`);
  await o.branch.query(`insert into labs (code, name) values ('L-4', 'رابع')`);
  await o.round();
  await o.round();
  const quiet = await o.round();
  assert.deepEqual(quiet.map((r) => r.pushed + r.pulled), [0, 0, 0, 0, 0]);
  for (const db of [o.desk, o.main, o.hosted, o.branch]) {
    const n = (await db.query(`select count(*)::int as n from labs where code in ('L-3','L-4')`)).rows[0].n;
    assert.equal(n, 2);
  }
});

test("each change is kept once per database, however it travelled", async () => {
  const o = await office();
  await o.desk.query(`insert into labs (code, name) values ('L-5', 'خامس')`);
  await o.round();
  await o.round();
  for (const db of [o.main, o.hosted, o.branch, o.desk]) {
    const r = await db.query(
      `select count(*)::int as n from _spir_changes where table_name = 'labs' and row->>'code' = 'L-5'`,
    );
    assert.equal(r.rows[0].n, 1);
  }
});

test("what came from a peer is never sent back to it", async () => {
  const o = await office();
  await o.desk.query(`insert into labs (code, name) values ('L-6', 'سادس')`);
  await core.syncOnce(o.desk, viaMain(o.main));
  // The main computer owes the hosted database the office's change…
  assert.ok((await core.pendingCount(o.main, "remote")) >= 1);
  // …but has nothing to give the office computer that sent it.
  const deskId = await core.nodeId(o.desk);
  const page = await core.servePull(o.main, "0", deskId, `n:${deskId}`);
  assert.equal(page.rows.length, 0);
});

test("a copy of the main computer becomes a computer of its own", async () => {
  const main = await fresh();
  await main.query(`insert into labs (code, name) values ('L-7', 'قبل النسخ')`);
  await main.query(`update _spir_branding set doc_prefix = 'MAIN'`);
  const dump = await main.pg.dumpDataDir();
  const copy = wrap(await PGlite.create({ loadDataDir: dump, extensions: { pgcrypto } }));

  await core.adoptClone(copy, "lan");
  assert.notEqual(await core.nodeId(copy), await core.nodeId(main));
  assert.equal(await labName(copy, "L-7"), "قبل النسخ", "the copy starts with the main computer's data");
  assert.equal(await core.pendingCount(copy, "lan"), 0, "and owes it nothing");
  assert.equal(await core.hasOwnWork(copy), false);
  const prefix = (await copy.query(`select doc_prefix from _spir_branding`)).rows[0].doc_prefix;
  assert.equal(prefix, null, "document numbers must not share the main computer's prefix");

  // Both keep working, and meet in the middle.
  await copy.query(`insert into labs (code, name) values ('L-8', 'من النسخة')`);
  await main.query(`update labs set name = 'بعد النسخ' where code = 'L-7'`);
  const r = await core.syncOnce(copy, viaMain(main));
  assert.equal(r.ok, true, r.error);
  assert.equal(await labName(main, "L-8"), "من النسخة");
  assert.equal(await labName(copy, "L-7"), "بعد النسخ");
  const again = await core.syncOnce(copy, viaMain(main));
  assert.equal(again.pushed + again.pulled, 0, "nothing echoes back");
});

test("a computer that has been away too long is told, not quietly left behind", async () => {
  const main = await fresh();
  const desk = await fresh();
  await desk.query(`insert into labs (code, name) values ('L-9', 'قديم')`);
  await main.query(`insert into labs (code, name) values ('L-10', 'سيُحذف من السجل')`);
  await main.query(`insert into labs (code, name) values ('L-11', 'يبقى')`);
  // The main computer has pruned its oldest change.
  await main.query(`delete from _spir_changes where seq = (select min(seq) from _spir_changes)`);
  const r = await core.syncOnce(desk, viaMain(main));
  assert.equal(r.ok, false);
  assert.equal(r.error, core.GAP_MESSAGE);
});

test("a change the peer refuses is recorded and stepped over", async () => {
  const main = await fresh();
  const desk = await fresh();
  // Same code, different ids: the second one breaks the unique code on arrival.
  await main.query(`insert into labs (code, name) values ('L-DUP', 'الرئيسي')`);
  await desk.query(`insert into labs (code, name) values ('L-DUP', 'المكتب')`);
  await desk.query(`insert into labs (code, name) values ('L-OK', 'سليم')`);
  const r = await core.syncOnce(desk, viaMain(main));
  assert.equal(r.ok, false);
  assert.match(r.error, /rejected/);
  assert.equal(await labName(main, "L-OK"), "سليم", "the good change still got through");
  const open = await desk.query(`select count(*)::int as n from _spir_sync_rejects where resolved_at is null`);
  assert.ok(open.rows[0].n >= 1);
});

// ---------------------------------------------------------------- codes and sealing
const codes = await importTs("src/lib/sync/code.ts");
const sealing = await importTs("src/lib/sync/seal.ts");

test("a sync code survives copying, with spaces and line breaks", () => {
  const code = { k: "lan", a: ["OFFICE-PC", "192.168.1.20"], p: 3310, s: sealing.newSecret(), n: "0b9e7c2a-1111-4222-8333-444455556666", c: "شركة الاختبار" };
  const text = codes.encodeSyncCode(code);
  assert.match(text, /^SPIR1-[A-Za-z0-9_-]+$/);
  const pasted = text.slice(0, 30) + "\n  " + text.slice(30);
  assert.deepEqual(codes.decodeSyncCode(pasted), code);
  assert.deepEqual(codes.decodeSyncCode(codes.encodeSyncCode({ k: "pg", u: "postgresql://u:p@h:5432/db" })), {
    k: "pg", u: "postgresql://u:p@h:5432/db",
  });
});

test("anything that is not a whole, valid code is refused", () => {
  const ok = codes.encodeSyncCode({ k: "lan", a: ["h"], p: 3310, s: sealing.newSecret(), n: "0b9e7c2a-1111-4222-8333-444455556666" });
  for (const bad of [
    "", "hello", "SPIR1-", "SPIR1-!!!", ok.slice(0, -10),
    codes.encodeSyncCode({ k: "lan", a: [], p: 3310, s: "x".repeat(43), n: "0b9e7c2a-1111-4222-8333-444455556666" }),
    codes.encodeSyncCode({ k: "lan", a: ["h"], p: 99999, s: "x".repeat(43), n: "0b9e7c2a-1111-4222-8333-444455556666" }),
    codes.encodeSyncCode({ k: "lan", a: ["h"], p: 3310, s: "short", n: "0b9e7c2a-1111-4222-8333-444455556666" }),
    codes.encodeSyncCode({ k: "pg", u: "http://not-postgres" }),
  ]) {
    assert.equal(codes.decodeSyncCode(bad), null, JSON.stringify(bad).slice(0, 60));
  }
});

test("a sealed message opens only with the same secret, for the same operation, untouched", () => {
  const secret = sealing.newSecret();
  const msg = Buffer.from(JSON.stringify({ node: "n", after: "42" }));
  const sealed = sealing.seal(secret, "pull", msg);
  assert.deepEqual(sealing.unseal(secret, "pull", sealed), msg);
  assert.ok(!sealed.includes(Buffer.from("after")), "the content is not readable on the wire");
  assert.throws(() => sealing.unseal(sealing.newSecret(), "pull", sealed), "another secret");
  assert.throws(() => sealing.unseal(secret, "push", sealed), "another operation");
  const tampered = Buffer.from(sealed);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => sealing.unseal(secret, "pull", tampered), "a changed byte");
  assert.throws(() => sealing.unseal(secret, "pull", Buffer.alloc(10)), "too short");
});
