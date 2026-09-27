// The code manager's judgements (src/lib/license/panel.ts): states, the filter
// tiles and their counts, the order, the time bar, inactive and outdated
// computers, the owner's prices, money per month, and the WhatsApp messages.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./helpers.mjs";

const p = await importTs("src/lib/license/panel.ts");
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 27, 9, 0, 0);
const dev = (over = {}) => ({ device_id: "d", label: "", name: "", activated_at: NOW - 40 * DAY, last_seen_at: NOW - DAY, app_version: "build-10",
  sync_kind: "hosted", sync_at: NOW - DAY, sync_pending: 0, sync_error: "", ...over });
const row = (over = {}) => ({
  id: "L", company: "شركة", note: "", code_hint: "ABCD", duration_days: 365, seats: 1, modules: ["sales"], status: "active",
  activated_at: NOW - 100 * DAY, expires_at: NOW + 265 * DAY, created_at: NOW - 100 * DAY, price: "", paid: false, paid_at: null,
  message: "", is_trial: false, phone: "", max_offline_days: 0, sync: null, devices: [], ...over,
});
const T = (k) => k;

test("states: stopped, not used yet, expired, ending within 14 days, active", () => {
  assert.equal(p.stateOf(row({ status: "stopped" }), NOW), "stopped");
  assert.equal(p.stateOf(row({ expires_at: null, activated_at: null }), NOW), "waiting");
  assert.equal(p.stateOf(row({ expires_at: NOW - 1 }), NOW), "expired");
  assert.equal(p.stateOf(row({ expires_at: NOW + 10 * DAY }), NOW), "expiring");
  assert.equal(p.stateOf(row(), NOW), "active");
});

test("filter tiles count each code where it belongs", () => {
  const rows = [
    row({ id: "a" }),
    row({ id: "b", expires_at: NOW + 5 * DAY, paid: true, paid_at: NOW }),
    row({ id: "c", is_trial: true, expires_at: null, activated_at: null }),
    row({ id: "d", devices: [dev({ last_seen_at: NOW - 45 * DAY }), dev({ device_id: "e", app_version: "build-7" })] }),
  ];
  const c = p.counts(rows, NOW, 10);
  assert.deepEqual([c.all, c.active, c.expiring, c.waiting, c.trial, c.unpaid, c.inactive, c.outdated], [4, 2, 1, 1, 1, 2, 1, 1]);
  assert.equal(c.unpaid, 2, "a trial is never counted as unpaid");
});

test("sorting: nearest expiry (not started last), newest, name, last seen", () => {
  const rows = [
    row({ id: "a", company: "ب", expires_at: NOW + 90 * DAY, created_at: 1 }),
    row({ id: "b", company: "أ", expires_at: null, created_at: 3 }),
    row({ id: "c", company: "ت", expires_at: NOW + 5 * DAY, created_at: 2, devices: [dev({ last_seen_at: NOW })] }),
  ];
  assert.deepEqual(p.sortRows(rows, "expiry").map((r) => r.id), ["c", "a", "b"]);
  assert.deepEqual(p.sortRows(rows, "newest").map((r) => r.id), ["b", "c", "a"]);
  assert.deepEqual(p.sortRows(rows, "name").map((r) => r.id), ["b", "a", "c"]);
  assert.equal(p.sortRows(rows, "seen")[0].id, "c");
});

test("the time bar: part of the period left, and days", () => {
  const t = p.timeLeft(row({ activated_at: NOW - 75 * DAY, expires_at: NOW + 25 * DAY }), NOW);
  assert.equal(t.days, 25);
  assert.ok(Math.abs(t.fraction - 0.25) < 1e-9);
  assert.equal(p.timeLeft(row({ expires_at: NOW - DAY }), NOW).fraction, 0);
  assert.equal(p.timeLeft(row({ expires_at: null }), NOW), null);
});

test("prices: stations and extra computers per month, times the months", () => {
  const plan = { currency: "IQD", stations: { sales: 50000, hr: 20000 }, seat: 10000, trialDays: 7 };
  assert.deepEqual(p.quote(plan, ["sales", "hr"], 365, 3), { monthly: 90000, months: 12, total: 1080000 });
  assert.equal(p.quote(plan, ["sales"], 7, 1).months, 1, "a week is billed as one month");
  assert.equal(p.priceNumber("250,000 IQD"), 250000);
  assert.equal(p.priceNumber("٢٥٠٠٠٠ دينار"), 250000);
  assert.equal(p.priceNumber(""), 0);
});

test("money: received per month, and what is still owed", () => {
  const f = p.finance([
    row({ price: "100000", paid: true, paid_at: Date.UTC(2026, 8, 2) }),
    row({ price: "50,000", paid: true, paid_at: Date.UTC(2026, 8, 20) }),
    row({ price: "70000", paid: true, paid_at: Date.UTC(2026, 7, 5) }),
    row({ price: "30000" }),
    row({ price: "999", is_trial: true }),
  ]);
  assert.deepEqual(f.months, [{ month: "2026-09", total: 150000, count: 2 }, { month: "2026-08", total: 70000, count: 1 }]);
  assert.deepEqual([f.paid, f.unpaid, f.unpaidCount], [220000, 30000, 1]);
  assert.equal(p.receiptNo(row({ paid: true, paid_at: Date.UTC(2026, 8, 2) })), "R-202609-ABCD");
});

test("messages: the activation message carries the code and the steps; the reminder the end date", () => {
  const a = p.activationMessage({ company: "شركة", code: "ABCD-EFGH-JKLM", days: 365, seats: 2, stations: ["المبيعات"], contact: "0780" }, T);
  assert.match(a, /ABCD-EFGH-JKLM/);
  assert.match(a, /To activate:/);
  assert.match(a, /0780/);
  const r = p.reminderMessage(row({ expires_at: Date.UTC(2026, 9, 5), price: "250000" }), NOW, T);
  assert.match(r, /2026-10-05/);
  assert.match(r, /250000/);
  assert.match(p.reminderMessage(row({ expires_at: NOW - DAY }), NOW, T), /ended on/);
});
