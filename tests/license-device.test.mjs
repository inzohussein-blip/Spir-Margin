// A computer's standing with its activation code (src/lib/license/state.ts),
// judged offline — and what the company's database carried by the code does
// to this computer's sync link.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./helpers.mjs";

const s = await importTs("src/lib/license/state.ts");
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 27, 9, 0, 0);
const lic = (over = {}) => ({ lid: "L1", co: "شركة", dev: "dev-1", mods: ["sales"], until: NOW + 30 * DAY, seats: 2, ...over });
const base = { hasServer: true, enabled: true, payload: null, deviceId: "dev-1", blocked: null, now: NOW, seen: NOW, legacy: false, graceStart: null };

test("no codes server, or codes switched off: nothing changes", () => {
  assert.equal(s.judge({ ...base, hasServer: false }).kind, "off");
  assert.equal(s.judge({ ...base, enabled: false }).kind, "off");
});

test("a server never reached still asks for the code: the first registration needs the internet", () => {
  assert.equal(s.judge({ ...base, enabled: null }).kind, "need");
});

test("a genuine license for this computer runs; one for another computer does not", () => {
  const ok = s.judge({ ...base, payload: lic() });
  assert.deepEqual([ok.kind, ok.company, ok.mods, ok.seats], ["ok", "شركة", ["sales"], 2]);
  assert.equal(s.judge({ ...base, payload: lic({ dev: "dev-2" }) }).kind, "need");
});

test("expired, stopped, moved away", () => {
  assert.equal(s.judge({ ...base, payload: lic({ until: NOW - 1 }) }).reason, "expired");
  assert.equal(s.judge({ ...base, payload: lic(), blocked: "stopped" }).reason, "stopped");
  assert.equal(s.judge({ ...base, payload: lic(), blocked: "expired" }).reason, "expired");
  assert.equal(s.judge({ ...base, payload: lic(), blocked: "other_device" }).reason, "gone");
  assert.equal(s.judge({ ...base, payload: lic(), blocked: "not_found" }).reason, "gone");
});

test("turning the clock back does not extend a period", () => {
  const back = s.judge({ ...base, payload: lic({ until: NOW + DAY }), now: NOW - 5 * DAY, seen: NOW });
  assert.equal(back.reason, "clock");
  const small = s.judge({ ...base, payload: lic(), now: NOW - 3600_000, seen: NOW });
  assert.equal(small.kind, "ok", "an hour back (a time-zone change) is not held against it");
  const past = s.judge({ ...base, payload: lic({ until: NOW + DAY }), now: NOW - 3600_000, seen: NOW + 2 * DAY });
  assert.equal(past.kind, "locked", "the latest time seen decides whether it is over");
});

test("a computer that predates codes runs 30 days, then asks", () => {
  const g = s.judge({ ...base, legacy: true, graceStart: NOW - 10 * DAY });
  assert.equal(g.kind, "grace");
  assert.equal(s.daysLeft(g, NOW), 20);
  assert.equal(s.judge({ ...base, legacy: true, graceStart: NOW - 31 * DAY }).reason, "grace_over");
  assert.equal(s.judge({ ...base, legacy: true, graceStart: null }).kind, "grace", "the 30 days start at the first look");
  assert.equal(s.judge({ ...base, legacy: true, payload: lic() }).kind, "ok", "once it has a code, the code decides");
});

test("which states close the app, and which stations are open", () => {
  assert.equal(s.isLocked({ kind: "need" }), true);
  assert.equal(s.isLocked({ kind: "locked", reason: "expired" }), true);
  assert.equal(s.isLocked({ kind: "grace", until: NOW }), false);
  assert.equal(s.isLocked({ kind: "off" }), false);
  const all = ["sales", "supply", "service"];
  assert.deepEqual(s.openStations({ kind: "ok", company: "x", until: NOW, mods: ["supply"], seats: 1 }, all), ["supply"]);
  assert.deepEqual(s.openStations({ kind: "grace", until: NOW }, all), all);
});

// ── the company's database, carried by the code ─────────────────────────────
const host = (u) => new URL(u).host;
const plan = (over) => s.planCompanyLink({
  fromEnvironment: false, current: null, setByCodeHost: "", lanLinked: false, incoming: null,
  host, unusable: (u) => new URL(u).port === "6543", ...over,
});
const CODE_DB = "postgresql://u:p@db.company.example:5432/postgres";
const OWN_DB = "postgresql://u:p@own.example:5432/postgres";

test("a computer with no link takes the code's database", () => {
  assert.deepEqual(plan({ incoming: CODE_DB }), { action: "set", conn: CODE_DB });
});

test("the company's own link, an office computer's main computer, and a deployed DATABASE_URL are never replaced", () => {
  assert.deepEqual(plan({ incoming: CODE_DB, current: OWN_DB }), { action: "none" });
  assert.deepEqual(plan({ incoming: CODE_DB, lanLinked: true }), { action: "none" });
  assert.deepEqual(plan({ incoming: CODE_DB, fromEnvironment: true }), { action: "none" });
});

test("a link the code made follows the code", () => {
  const NEW_DB = "postgresql://u:p@db2.company.example:5432/postgres";
  assert.deepEqual(plan({ incoming: NEW_DB, current: CODE_DB, setByCodeHost: host(CODE_DB) }), { action: "set", conn: NEW_DB });
  assert.deepEqual(plan({ incoming: null, current: CODE_DB, setByCodeHost: host(CODE_DB) }), { action: "clear" });
  assert.deepEqual(plan({ incoming: null, current: OWN_DB }), { action: "none" }, "removing the code's link never removes the company's own");
  assert.deepEqual(plan({ incoming: CODE_DB, current: CODE_DB }), { action: "note", host: host(CODE_DB) }, "the same address, set by hand, becomes the code's");
});

test("an unusable or garbled address is ignored", () => {
  assert.deepEqual(plan({ incoming: "postgresql://u:p@pooler.example:6543/postgres" }), { action: "none" });
  assert.deepEqual(plan({ incoming: "not a url" }), { action: "none" });
});
