// When an automatic backup is due (src/lib/backup/schedule.ts, run as is).
// Times are Baghdad (UTC+3, no daylight saving): 22:00 there is 19:00 UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./helpers.mjs";

const { isDue, lastSlot, nextRun } = await importTs("src/lib/backup/schedule.ts");
const TZ = "Asia/Baghdad";
const at = (iso) => new Date(iso);
const daily = { frequency: "daily", everyHours: 6, atTime: "22:00", weekday: 4 };
const weekly = { ...daily, frequency: "weekly" };      // Thursdays
const hourly = { ...daily, frequency: "hours", everyHours: 6 };

test("a daily backup is due once 22:00 Baghdad has passed, and not before", () => {
  const lastNight = at("2026-09-22T19:05:00Z"); // 22:05 on the 22nd
  assert.equal(isDue(daily, lastNight, at("2026-09-23T18:59:00Z"), TZ), false, "21:59 on the 23rd");
  assert.equal(isDue(daily, lastNight, at("2026-09-23T19:00:00Z"), TZ), true, "22:00 on the 23rd");
  assert.equal(lastSlot(daily, at("2026-09-23T10:00:00Z"), TZ).toISOString(), "2026-09-22T19:00:00.000Z");
});

test("a computer that was off at the time backs up as soon as it is on", () => {
  const twoDaysAgo = at("2026-09-21T19:10:00Z");
  assert.equal(isDue(daily, twoDaysAgo, at("2026-09-23T06:00:00Z"), TZ), true);
});

test("once taken, it is not taken again until the next slot", () => {
  const justNow = at("2026-09-23T19:01:00Z");
  assert.equal(isDue(daily, justNow, at("2026-09-23T20:30:00Z"), TZ), false);
  assert.equal(nextRun(daily, justNow, at("2026-09-23T20:30:00Z"), TZ).toISOString(), "2026-09-24T19:00:00.000Z");
});

test("the very first one is due at once", () => {
  assert.equal(isDue(daily, null, at("2026-09-23T08:00:00Z"), TZ), true);
  assert.equal(isDue(hourly, null, at("2026-09-23T08:00:00Z"), TZ), true);
});

test("weekly: the last Thursday at 22:00, even across a month", () => {
  // 2026-10-01 is a Thursday.
  assert.equal(lastSlot(weekly, at("2026-10-03T12:00:00Z"), TZ).toISOString(), "2026-10-01T19:00:00.000Z");
  assert.equal(lastSlot(weekly, at("2026-10-01T18:00:00Z"), TZ).toISOString(), "2026-09-24T19:00:00.000Z");
  assert.equal(isDue(weekly, at("2026-09-24T19:30:00Z"), at("2026-09-30T12:00:00Z"), TZ), false);
  assert.equal(isDue(weekly, at("2026-09-24T19:30:00Z"), at("2026-10-01T19:00:00Z"), TZ), true);
});

test("every few hours counts from the last backup", () => {
  const last = at("2026-09-23T06:00:00Z");
  assert.equal(isDue(hourly, last, at("2026-09-23T11:59:00Z"), TZ), false);
  assert.equal(isDue(hourly, last, at("2026-09-23T12:00:00Z"), TZ), true);
  assert.equal(nextRun(hourly, last, at("2026-09-23T07:00:00Z"), TZ).toISOString(), "2026-09-23T12:00:00.000Z");
});
