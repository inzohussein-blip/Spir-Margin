// The daily calendar (src/lib/calendar.ts): whole weeks from Saturday to
// Friday, a leave clipped to the month, events grouped by day in time order.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./helpers.mjs";

const c = await importTs("src/lib/calendar.ts");

test("a month is drawn in whole weeks, Saturday first", () => {
  const g = c.monthGrid("2026-09");
  assert.equal(g.length % 7, 0);
  assert.equal(new Date(g[0] + "T00:00:00Z").getUTCDay(), 6);
  assert.equal(new Date(g.at(-1) + "T00:00:00Z").getUTCDay(), 5);
  assert.ok(g.includes("2026-09-01") && g.includes("2026-09-30"));
  assert.equal(g[0], "2026-08-29"); // 1 Sep 2026 is a Tuesday
  assert.equal(g.at(-1), "2026-10-02");
});

test("February in a leap year, and a month that starts on Saturday", () => {
  assert.ok(c.monthGrid("2028-02").includes("2028-02-29"));
  assert.equal(c.monthGrid("2026-08")[0], "2026-08-01");
});

test("a stretch of days is clipped to the range", () => {
  assert.deepEqual(c.spanDays("2026-08-30", "2026-09-02", "2026-09-01", "2026-09-30"), ["2026-09-01", "2026-09-02"]);
  assert.deepEqual(c.spanDays("2026-09-05", "2026-09-04", "2026-09-01", "2026-09-30"), []);
  assert.equal(c.addDays("2026-12-31", 1), "2027-01-01");
});

test("events grouped by day, earliest first", () => {
  const m = c.byDay([
    { date: "2026-09-02", kind: "appointment", title: "B", href: "/b", time: "14:00" },
    { date: "2026-09-02", kind: "appointment", title: "A", href: "/a", time: "09:30" },
    { date: "2026-09-03", kind: "due", title: "INV-1", href: "/i" },
  ]);
  assert.deepEqual(m.get("2026-09-02").map((e) => e.title), ["A", "B"]);
  assert.equal(m.get("2026-09-03").length, 1);
});
