// Is there a recent copy of the records anywhere else? (src/lib/backup/copies.ts, run as is)
import { test } from "node:test";
import assert from "node:assert/strict";
import { importTs } from "./helpers.mjs";

const { copyState, FRESH_DAYS } = await importTs("src/lib/backup/copies.ts");
const now = new Date("2026-09-24T12:00:00Z");
const ago = (days) => new Date(now.getTime() - days * 86_400_000).toISOString();
const none = { hasRecords: true, upstreamSyncAt: null, officeSyncAt: null, outsideBackupAt: null };

test("records with no copy anywhere else are at risk", () => {
  assert.deepEqual(copyState(none, now), { newest: null, atRisk: true, daysSince: null });
});

test("an empty database is not at risk: there is nothing to lose yet", () => {
  assert.equal(copyState({ ...none, hasRecords: false }, now).atRisk, false);
});

test("any recent copy counts: the upstream, an office computer, or a backup on another drive", () => {
  for (const key of ["upstreamSyncAt", "officeSyncAt", "outsideBackupAt"]) {
    const s = copyState({ ...none, [key]: ago(1) }, now);
    assert.equal(s.atRisk, false, key);
    assert.equal(s.daysSince, 1, key);
  }
});

test("the newest copy is the one that counts, and an old one does not", () => {
  const s = copyState({ ...none, officeSyncAt: ago(10), outsideBackupAt: ago(2) }, now);
  assert.equal(s.newest.kind, "backup");
  assert.equal(s.atRisk, false);
  const stale = copyState({ ...none, officeSyncAt: ago(FRESH_DAYS), outsideBackupAt: ago(30) }, now);
  assert.equal(stale.atRisk, true, `${FRESH_DAYS} days is too old`);
  assert.equal(stale.daysSince, FRESH_DAYS);
});

test("an unreadable time is ignored rather than trusted", () => {
  assert.equal(copyState({ ...none, officeSyncAt: "not a date" }, now).atRisk, true);
});
