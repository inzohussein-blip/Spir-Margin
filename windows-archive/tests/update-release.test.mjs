// Releases and versions (src/lib/update/release.ts, run as is), and the
// migration that holds the automatic-update choice.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bootWithMigrations, importTs } from "./helpers.mjs";

const { parseVersionFile, parseRelease, isNewer, parseStatus, isRunning, STUCK_AFTER_MS, SAVE_UPDATE_SETTINGS_SQL } =
  await importTs("src/lib/update/release.ts");

const github = (over = {}) => ({
  tag_name: "build-12",
  draft: false,
  prerelease: false,
  published_at: "2026-09-24T08:15:00Z",
  assets: [
    { name: "notes.txt", browser_download_url: "https://example.invalid/notes.txt" },
    { name: "spir-margin.zip", browser_download_url: "https://example.invalid/spir-margin.zip" },
  ],
  ...over,
});

test("a release is read from GitHub's answer: its number, date and zip", () => {
  assert.deepEqual(parseRelease(github()), { number: 12, date: "2026-09-24", zip: "https://example.invalid/spir-margin.zip" });
});

test("anything that is not one of our releases is ignored", () => {
  assert.equal(parseRelease(github({ tag_name: "v1.0" })), null, "someone's hand-made tag");
  assert.equal(parseRelease(github({ draft: true })), null);
  assert.equal(parseRelease(github({ prerelease: true })), null);
  assert.equal(parseRelease(github({ assets: [] })), null, "no zip to install");
  assert.equal(parseRelease({ message: "Not Found" }), null);
  assert.equal(parseRelease(null), null);
});

test("version.json, with or without the BOM Windows tools add", () => {
  const text = '{"number":7,"commit":"abc","date":"2026-09-20"}';
  assert.deepEqual(parseVersionFile(text), { number: 7, commit: "abc", date: "2026-09-20" });
  assert.deepEqual(parseVersionFile("﻿" + text), { number: 7, commit: "abc", date: "2026-09-20" });
  assert.equal(parseVersionFile("not json"), null);
  assert.equal(parseVersionFile('{"number":0}'), null);
});

test("newer means a higher number; a copy from before releases is behind any", () => {
  const rel = parseRelease(github());
  assert.equal(isNewer(rel, { number: 11, commit: null, date: null }), true);
  assert.equal(isNewer(rel, { number: 12, commit: null, date: null }), false);
  assert.equal(isNewer(rel, { number: 13, commit: null, date: null }), false);
  assert.equal(isNewer(rel, null), true);
  assert.equal(isNewer(null, null), false);
});

test("an update counts as running only while working, and not forever", () => {
  const now = new Date("2026-09-24T10:00:00Z");
  const s = (state, at = "2026-09-24T09:55:00Z") => parseStatus(JSON.stringify({ state, number: 12, detail: "", at, pid: 1 }));
  assert.equal(isRunning(s("building"), now), true);
  assert.equal(isRunning(s("switching"), now), true);
  assert.equal(isRunning(s("done"), now), false);
  assert.equal(isRunning(s("failed"), now), false);
  assert.equal(isRunning(s("rolledback"), now), false);
  const stale = new Date(now.getTime() - STUCK_AFTER_MS - 1000).toISOString();
  assert.equal(isRunning(s("building", stale), now), false, "an updater killed mid-build must not block the next");
  assert.equal(parseStatus('﻿{"state":"done","number":3}').state, "done");
  assert.equal(parseStatus('{"state":"exploded"}'), null);
});

test("automatic updates start switched off, and at a quiet hour", () => {
  const sql = readFileSync("supabase/migrations/0112_auto_update.sql", "utf8");
  assert.match(sql, /auto\s+boolean not null default false/);
  assert.match(sql, /at_time\s+text\s+not null default '02:00'/);
});

test("switching automatic updates on waits for the next scheduled time", async () => {
  const db = await bootWithMigrations();
  try {
    const row = async () => (await db.query(`select auto, at_time, last_auto_at from _spir_update`)).rows[0];
    assert.deepEqual(await row(), { auto: false, at_time: "02:00", last_auto_at: null });

    await db.query(SAVE_UPDATE_SETTINGS_SQL, [true, "03:30"]);
    const on = await row();
    assert.equal(on.auto, true);
    assert.equal(on.at_time, "03:30");
    assert.ok(on.last_auto_at, "counted from now, so it does not install this minute");

    // Saving again while on keeps the time it last ran.
    await db.query(`update _spir_update set last_auto_at = '2026-01-01T00:00:00Z'`);
    await db.query(SAVE_UPDATE_SETTINGS_SQL, [true, "04:00"]);
    assert.equal(new Date((await row()).last_auto_at).toISOString(), "2026-01-01T00:00:00.000Z");

    await db.query(SAVE_UPDATE_SETTINGS_SQL, [false, "04:00"]);
    assert.equal((await row()).auto, false);
    await assert.rejects(db.query(SAVE_UPDATE_SETTINGS_SQL, [true, "25:00"]), "not a time");
  } finally {
    await db.close();
  }
});
