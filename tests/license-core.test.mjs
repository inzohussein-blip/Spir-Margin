// Activation codes: the codes server's core (src/lib/license/core.ts), run as
// is against an embedded Postgres — one code per company, a number of
// computers (seats), signed licenses checked offline.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { importTs } from "./helpers.mjs";

const core = await importTs("src/lib/license/core.ts");
const stations = await importTs("src/lib/license/modules.ts");
const totp = await importTs("src/lib/license/totp.ts");

let db;
let lic;
const SECRET = "test-auth-secret";
before(async () => {
  db = new PGlite();
  await core.ensureTables(db);
  lic = new core.Licenses(db, SECRET, stations.cleanStations);
});
after(async () => { await db.close(); });

test("codes are readable over the phone and stored only as a hash", async () => {
  const c = core.newCode();
  assert.match(c, /^[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}-[2-9A-HJKMNP-Z]{4}$/);
  assert.equal(core.normalizeCode(c.toLowerCase().replace(/-/g, " ")), c.replace(/-/g, ""));
  const { row, code } = await lic.create({ company: "شركة التجربة", days: 30, seats: 2, modules: ["sales", "supply"] });
  const stored = (await db.query(`select code_hash, code_hint from _spir_lic where id = $1`, [row.id])).rows[0];
  assert.equal(stored.code_hash, core.hashCode(code));
  assert.equal(stored.code_hint, code.slice(-4));
  assert.ok(!JSON.stringify((await db.query(`select * from _spir_lic`)).rows).includes(code));
  assert.deepEqual(row.modules, ["sales", "supply"]);
  assert.equal(row.seats, 2);
  assert.equal(row.expires_at, null, "the period starts at the first computer, not at creation");
});

test("the first computer starts the period, more take seats, then the code is full", async () => {
  const { row, code } = await lic.create({ company: "مختبرات الرافدين", days: 10, seats: 2, modules: null });
  assert.deepEqual(row.modules, stations.DEFAULT_STATIONS, "a garbled station list gives the default set");

  const a = await lic.activate(code, "device-aaaa-1111", "Windows · PC-A", "build-7");
  assert.equal(a.ok, true);
  const p = core.verifyLicense(a.token, a.pub);
  assert.equal(p.lid, row.id);
  assert.equal(p.dev, "device-aaaa-1111");
  assert.equal(p.co, "مختبرات الرافدين");
  assert.equal(p.seats, 2);
  assert.ok(Math.abs(p.until - (Date.now() + 10 * core.DAY)) < 60_000);

  const again = await lic.activate(code.toLowerCase(), "device-aaaa-1111", "Windows · PC-A");
  assert.equal(again.ok, true, "the same computer entering the code again keeps its seat");

  const b = await lic.activate(code, "device-bbbb-2222", "Windows · PC-B");
  assert.equal(b.ok, true);
  const bp = core.verifyLicense(b.token, b.pub);
  assert.equal(bp.until, p.until, "every computer of the company shares one period");

  const c = await lic.activate(code, "device-cccc-3333", "Windows · PC-C");
  assert.deepEqual([c.ok, c.error], [false, "seats_full"]);

  const cur = await lic.get(row.id);
  assert.equal(cur.devices.length, 2);
  await lic.update(row.id, { action: "reset_device", device: "device-bbbb-2222" });
  assert.equal((await lic.activate(code, "device-cccc-3333", "PC-C")).ok, true, "freeing a seat lets another computer in");

  assert.equal((await lic.check(row.id, "device-bbbb-2222")).error, "other_device");
  assert.equal((await lic.check(row.id, "device-cccc-3333")).ok, true);
});

test("a license is judged offline by its signature; a forged one is refused", async () => {
  const { code } = await lic.create({ company: "X", days: 5, seats: 1, modules: ["sales"] });
  const r = await lic.activate(code, "device-forge-0001", "PC");
  const [h, b, s] = r.token.split(".");
  const body = JSON.parse(Buffer.from(b, "base64url").toString());
  body.mods = stations.STATION_IDS;
  body.until = Date.now() + 999 * core.DAY;
  const forged = `${h}.${Buffer.from(JSON.stringify(body)).toString("base64url")}.${s}`;
  assert.equal(core.verifyLicense(forged, r.pub), null);
  const other = core.newKeyPair();
  assert.equal(core.verifyLicense(r.token, other.pub), null, "another key does not verify it");
  assert.ok(core.verifyLicense(r.token, r.pub));
});

test("the signing key is kept sealed; a new AUTH_SECRET makes a new key", async () => {
  const raw = (await db.query(`select value from _spir_lic_config where key = 'signing_key'`)).rows[0].value;
  assert.ok(!raw.includes('"d"'), "the private part is not stored in the clear");
  const k1 = await core.signingKeys(db, SECRET);
  const k2 = await core.signingKeys(db, SECRET);
  assert.deepEqual(k1.pub, k2.pub);
  const k3 = await core.signingKeys(db, "another-secret");
  assert.notDeepEqual(k3.pub, k1.pub);
  await core.signingKeys(db, SECRET); // back to a key this secret opens
});

test("stop, resume, extend, expiry and the history", async () => {
  const { row, code } = await lic.create({ company: "شركة المدة", days: 3, seats: 1, modules: ["service"] });
  await lic.update(row.id, { action: "extend", days: 4 });
  assert.equal((await lic.get(row.id)).duration_days, 7, "before activation, extending adds days");
  await lic.activate(code, "device-time-0001", "PC");
  const until = (await lic.get(row.id)).expires_at;
  await lic.update(row.id, { action: "extend", days: 10 });
  assert.equal((await lic.get(row.id)).expires_at, until + 10 * core.DAY);

  await lic.update(row.id, { action: "stop" });
  assert.equal((await lic.check(row.id, "device-time-0001")).error, "stopped");
  assert.equal((await lic.activate(code, "device-time-0001", "PC")).error, "stopped");
  await lic.update(row.id, { action: "resume" });
  assert.equal((await lic.check(row.id, "device-time-0001")).ok, true);

  await db.query(`update _spir_lic set expires_at = $2 where id = $1`, [row.id, Date.now() - 1000]);
  assert.equal((await lic.check(row.id, "device-time-0001")).error, "expired");

  const kinds = (await lic.events()).filter((e) => e.license_id === row.id).map((e) => e.kind);
  for (const k of ["created", "extended", "activated", "stopped", "resumed"]) assert.ok(kinds.includes(k), k);
});

test("new code, stations, seats, payment, message and delete", async () => {
  const { row, code } = await lic.create({ company: "شركة التعديل", days: 30, seats: 1, modules: ["sales"] });
  const { code: fresh } = await lic.update(row.id, { action: "new_code" });
  assert.notEqual(fresh, code);
  assert.equal((await lic.activate(code, "device-new-00001", "PC")).error, "not_found", "the old code stops working");
  assert.equal((await lic.activate(fresh, "device-new-00001", "PC")).ok, true);

  await lic.update(row.id, { action: "modules", modules: ["sales", "accounts", "bogus"] });
  await lic.update(row.id, { action: "seats", seats: 5 });
  await lic.update(row.id, { action: "payment", price: "250$", paid: true });
  await lic.update(row.id, { action: "message", text: "تجديد الاشتراك قريباً" });
  await lic.update(row.id, { action: "device_name", device: "device-new-00001", name: "حاسوب الاستقبال" });
  const cur = await lic.get(row.id);
  assert.deepEqual(cur.modules, ["sales", "accounts"]);
  assert.equal(cur.seats, 5);
  assert.equal(cur.paid, true);
  assert.ok(cur.paid_at);
  assert.equal(cur.message, "تجديد الاشتراك قريباً");
  assert.equal(cur.devices[0].name, "حاسوب الاستقبال");
  const r = await lic.check(row.id, "device-new-00001");
  assert.deepEqual(core.verifyLicense(r.token, r.pub).mods, ["sales", "accounts"], "the next check carries the new stations");

  await lic.update(row.id, { action: "delete" });
  assert.equal(await lic.get(row.id), null);
  assert.equal((await db.query(`select count(*)::int as n from _spir_lic_devices where license_id = $1`, [row.id])).rows[0].n, 0);
});

test("a company's database link is sealed and reaches its computers", async () => {
  const { row, code } = await lic.create({ company: "شركة المزامنة", days: 30, seats: 2, modules: null });
  const conn = "postgresql://postgres.abc:s3cret-pw@aws-0-eu.pooler.supabase.com:5432/postgres";
  assert.equal(await lic.setSync(row.id, conn, "aws-0-eu.pooler.supabase.com:5432/postgres", "owner"), null);
  const raw = (await db.query(`select sync_config, sync_info from _spir_lic where id = $1`, [row.id])).rows[0];
  assert.ok(!raw.sync_config.includes("s3cret-pw"), "the password is not stored in the clear");
  assert.equal(JSON.parse(raw.sync_info).host, "aws-0-eu.pooler.supabase.com:5432/postgres");
  const a = await lic.activate(code, "device-sync-0001", "PC");
  assert.equal(a.sync.conn, conn);
  assert.equal((await lic.get(row.id)).sync.by, "owner");

  const other = new core.Licenses(db, "a-different-secret", stations.cleanStations);
  assert.equal(await other.getSync(row.id), null, "without the secret the link does not open");

  await lic.setSync(row.id, null, "", "owner");
  assert.equal((await lic.check(row.id, "device-sync-0001")).sync, null);
  await lic.noteDeviceSync(row.id, "db.example.com:5432/postgres");
  assert.deepEqual([(await lic.get(row.id)).sync.by, (await lic.get(row.id)).sync.host], ["device", "db.example.com:5432/postgres"]);
});

test("wrong-code attempts are counted per address", async () => {
  for (let i = 0; i < 3; i++) await lic.noteAttempt("activate", "10.0.0.9");
  assert.equal(await lic.blocked("activate", "10.0.0.9", 3), true);
  assert.equal(await lic.blocked("activate", "10.0.0.8", 3), false);
  await lic.clearAttempts("activate", "10.0.0.9");
  assert.equal(await lic.blocked("activate", "10.0.0.9", 3), false);
});

test("a backup restores codes, computers and history into an empty database", async () => {
  const backup = await lic.exportAll();
  assert.equal(backup.app, "spir-codes");
  assert.ok(!JSON.stringify(backup).includes("signing_key"), "the signing key is left out");
  const fresh = new PGlite();
  await core.ensureTables(fresh);
  const other = new core.Licenses(fresh, SECRET, stations.cleanStations);
  const r = await other.importAll(JSON.parse(JSON.stringify(backup)));
  assert.equal(r.licenses, backup.licenses.length);
  assert.equal(r.devices, backup.devices.length);
  const rows = await other.list();
  const orig = await lic.list();
  assert.deepEqual(rows.map((x) => [x.id, x.company, x.seats, x.devices.length]).sort(), orig.map((x) => [x.id, x.company, x.seats, x.devices.length]).sort());
  await assert.rejects(() => other.importAll({ app: "other" }));
  await fresh.close();
});

test("authenticator codes follow RFC 6238", () => {
  // RFC 6238 test secret "12345678901234567890" (base32 GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ), SHA-1, t = 59 s → 287082.
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(totp.totpCode(secret, totp.totpStep(59_000)), "287082");
  assert.equal(totp.totpMatch(secret, "287082", 59_000), totp.totpStep(59_000));
  assert.equal(totp.totpMatch(secret, "000000", 59_000), null);
  assert.match(totp.totpUri(secret, "owner", "Spir-Margin codes"), /^otpauth:\/\/totp\//);
});

test("stations map onto the sidebar groups", () => {
  const closed = stations.closedGroups(["sales", "accounts"]);
  for (const g of ["Buying", "Stock", "Assets", "Maintenance", "Support", "Manufacturing"]) assert.ok(closed.has(g), g);
  for (const g of ["Selling", "CRM", "Shortcuts", "Accounting", "Reports", "Tools", "Home", "Setup", "Monitoring"]) assert.ok(!closed.has(g), g);
  assert.equal(stations.closedGroups(stations.STATION_IDS).size, 0);
});

test("printed documents: the code's verify key signs them; a changed fact fails", async () => {
  const dv = await importTs("src/lib/license/doc-verify.ts");
  const { row, code } = await lic.create({ company: "شركة الفواتير", days: 30, seats: 1 });
  const res = await lic.activate(code, "dev-print", "حاسوب");
  assert.equal(res.ok, true);
  assert.match(res.vkey, /^[0-9a-f]{64}$/, "the license brings the key");
  assert.equal(await lic.verifyKey(row.id), res.vkey, "and it stays the same");
  await lic.update(row.id, { action: "new_code" });
  assert.equal(await lic.verifyKey(row.id), res.vkey, "a new code keeps the key: printed papers stay valid");

  const facts = { k: "فاتورة", n: "SI-0042", d: "2026-09-27", a: 1250.5, c: "USD", p: "مختبر النور" };
  const token = dv.signDoc(row.id, res.vkey, facts);
  assert.ok(token.length < 400, "short enough for a small QR");
  const open = dv.openDoc(token);
  assert.deepEqual([open.l, open.n, open.a, open.p], [row.id, "SI-0042", 1250.5, "مختبر النور"]);
  assert.equal(dv.docValid(token, res.vkey), true);
  const [body, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), a: 12.5 })).toString("base64url");
  assert.equal(dv.docValid(`${forged}.${sig}`, res.vkey), false, "a changed total fails");
  assert.equal(dv.docValid(token, "0".repeat(64)), false, "another company's key fails");
  assert.equal(dv.openDoc("garbage"), null);
});

test("phone, offline limit, each computer's sync report, the owner's log and prices — and they survive a backup", async () => {
  const { row, code } = await lic.create({ company: "مختبر الهاتف", days: 90, seats: 1, modules: ["sales"], phone: "٠٧٨٠ 399 3585 abc", maxOfflineDays: 30, price: "150,000 IQD" });
  assert.deepEqual([row.phone, row.max_offline_days, row.price], ["0780 399 3585", 30, "150,000 IQD"]);
  const a = await lic.activate(code, "device-phone-1", "PC");
  assert.equal(core.verifyLicense(a.token, a.pub).off, 30, "the license carries the offline limit");
  await lic.update(row.id, { action: "offline", days: 9999 });
  assert.equal((await lic.get(row.id)).max_offline_days, core.MAX_OFFLINE_DAYS);
  await lic.update(row.id, { action: "offline", days: 0 });
  const b = await lic.check(row.id, "device-phone-1", "build-9", core.cleanSyncReport({ kind: "lan", at: 1_700_000_000_000, pending: 12.7, error: "x".repeat(500) }));
  assert.equal(core.verifyLicense(b.token, b.pub).off, undefined, "no limit: none in the license");
  const d = (await lic.get(row.id)).devices[0];
  assert.deepEqual([d.sync_kind, d.sync_at, d.sync_pending, d.sync_error.length], ["lan", 1_700_000_000_000, 13, 200]);
  assert.equal(core.cleanSyncReport("nope"), null);
  assert.equal(core.cleanSyncReport({ kind: "evil" }).kind, "none");

  await lic.logAction({ ip: "1.2.3.4", agent: "Chrome", license_id: row.id, company: row.company, action: "extend", detail: "+30" });
  const acts = await lic.actions();
  assert.deepEqual([acts[0].ip, acts[0].action, acts[0].company], ["1.2.3.4", "extend", "مختبر الهاتف"]);

  const plan = await lic.setPlan({ currency: "IQD", stations: { sales: "50000", "bad key!": 5, hr: -3 }, seat: 10000, trialDays: 999 });
  assert.deepEqual(plan, { currency: "IQD", stations: { sales: 50000, hr: 0 }, seat: 10000, trialDays: 60 });
  assert.deepEqual(await lic.plan(), plan);

  const backup = JSON.parse(JSON.stringify(await lic.exportAll()));
  const fresh = new PGlite();
  await core.ensureTables(fresh);
  const other = new core.Licenses(fresh, SECRET, stations.cleanStations);
  await other.importAll(backup);
  const back = await other.get(row.id);
  assert.deepEqual([back.phone, back.max_offline_days], ["0780 399 3585", 0]);
  assert.equal((await other.actions()).length, acts.length);
  assert.deepEqual(await other.plan(), plan);
  await fresh.close();
});
