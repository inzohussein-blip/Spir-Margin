// Remote access (migration 0113): pairing codes, device cookies, addresses,
// per-computer sync codes, and a joining computer not inheriting the main
// computer's devices. src/lib/remote/tokens.ts, sync/code.ts and sync/core.ts
// run as they are.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, importTs } from "./helpers.mjs";

const tok = await importTs("src/lib/remote/tokens.ts");
const { encodeSyncCode, decodeSyncCode } = await importTs("src/lib/sync/code.ts");
const core = await importTs("src/lib/sync/core.ts");

test("a pairing code is eight digits in two groups, and is read however it is typed", () => {
  for (let i = 0; i < 50; i++) assert.match(tok.newPairCode(), /^\d{4}-\d{4}$/);
  assert.equal(tok.normalizePairCode("1234-5678"), "12345678");
  assert.equal(tok.normalizePairCode(" 1234 5678 "), "12345678");
  assert.equal(tok.normalizePairCode("١٢٣٤-٥٦٧٨"), "12345678", "Arabic-Indic digits from a phone keyboard");
  assert.equal(tok.normalizePairCode("۱۲۳۴۵۶۷۸"), "12345678", "Persian digits too");
});

test("the device cookie is found among others, and taken out before the program sees them", () => {
  const id = "0f8fad5b-d9cb-469f-a165-70867728950e";
  const token = "x".repeat(43);
  const header = `spir_session=abc; spir_device=${id}.${token}; spir_locale=ar`;
  assert.deepEqual(tok.readDeviceCookie(header), { id, token });
  assert.equal(tok.withoutDeviceCookie(header), "spir_session=abc; spir_locale=ar");
  assert.equal(tok.withoutDeviceCookie(`spir_device=${id}.${token}`), undefined);
  assert.equal(tok.readDeviceCookie("spir_device=not-a-uuid.abc"), null);
  assert.equal(tok.readDeviceCookie(`spir_device=${id}.short`), null);
  assert.equal(tok.readDeviceCookie(undefined), null);
});

test("Tailscale addresses are told apart from the office network's", () => {
  assert.equal(tok.addressKind("100.101.102.103"), "tailscale");
  assert.equal(tok.addressKind("100.64.0.1"), "tailscale");
  assert.equal(tok.addressKind("100.127.255.254"), "tailscale");
  assert.equal(tok.addressKind("100.63.0.1"), "lan", "just below 100.64.0.0/10");
  assert.equal(tok.addressKind("100.128.0.1"), "lan", "just above");
  assert.equal(tok.addressKind("192.168.1.10"), "lan");
  assert.equal(tok.addressKind("OFFICE-PC"), "name");
});

test("the program's redirects to its own address are made relative, others are left alone", () => {
  assert.equal(tok.ownAddressToPath("http://localhost:3000/login?next=%2Flabs", 3000), "/login?next=%2Flabs");
  assert.equal(tok.ownAddressToPath("http://127.0.0.1:3000/", 3000), "/");
  assert.equal(tok.ownAddressToPath("/sync?done=1", 3000), "/sync?done=1");
  assert.equal(tok.ownAddressToPath("http://localhost:3001/x", 3000), "http://localhost:3001/x");
  assert.equal(tok.ownAddressToPath("https://example.com/x", 3000), "https://example.com/x");
});

test("pairing attempts are limited per address, and the limit passes", () => {
  const lim = new tok.AttemptLimiter(3, 60_000);
  const t0 = 1_000_000;
  assert.ok(lim.allow("a", t0) && lim.allow("a", t0 + 1) && lim.allow("a", t0 + 2));
  assert.equal(lim.allow("a", t0 + 3), false, "the fourth try within the window");
  assert.equal(lim.allow("b", t0 + 3), true, "another address is not held back");
  assert.equal(lim.allow("a", t0 + 60_001), true, "after the window");
});

test("a computer's own sync code carries its device id; a bad one is dropped", () => {
  const base = { k: "lan", a: ["PC", "192.168.1.10"], p: 3310, s: "s".repeat(43), n: "0f8fad5b-d9cb-469f-a165-70867728950e" };
  const d = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
  assert.deepEqual(decodeSyncCode(encodeSyncCode({ ...base, d })), { ...base, d });
  assert.deepEqual(decodeSyncCode(encodeSyncCode(base)), base, "the shared code of older versions still reads");
  assert.deepEqual(decodeSyncCode(encodeSyncCode({ ...base, d: "nope" })), base);
});

test("devices: pairing codes expire, and a joining computer does not inherit the main computer's", async () => {
  const db = await bootWithMigrations();
  try {
    const gw = (await db.query(`select enabled, port, require_device from _spir_gateway`)).rows[0];
    assert.deepEqual(gw, { enabled: false, port: 3300, require_device: true }, "off by default, pairing required");
    await assert.rejects(db.query(`insert into _spir_devices (name, kind) values ('x', 'phone')`), "only browsers and computers");
    await assert.rejects(db.query(`update _spir_gateway set port = 80`), "no privileged ports");

    await db.query(`update _spir_gateway set enabled = true`);
    await db.query(
      `insert into _spir_devices (name, kind, pair_hash, pair_expires_at) values
         ('laptop', 'browser', 'h1', now() + interval '15 minutes'),
         ('old', 'browser', 'h2', now() - interval '1 minute')`,
    );
    await db.query(`insert into _spir_devices (name, kind, secret) values ('office', 'computer', 's')`);
    const live = await db.query(`select name from _spir_devices where pair_hash is not null and pair_expires_at > now()`);
    assert.deepEqual(live.rows.map((r) => r.name), ["laptop"]);

    await core.adoptClone(db, "lan");
    assert.equal((await db.query(`select count(*)::int as n from _spir_devices`)).rows[0].n, 0);
    assert.equal((await db.query(`select enabled from _spir_gateway`)).rows[0].enabled, false);
  } finally {
    await db.close();
  }
});
