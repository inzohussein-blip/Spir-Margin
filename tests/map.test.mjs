// docs/FILES.md (the index of every source file, scripts/map.mjs) must list
// exactly the files that exist: a file added or removed without `npm run map`
// would leave the map pointing at nothing, or hide the new file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("docs/FILES.md lists every source file", () => {
  const r = spawnSync(process.execPath, ["scripts/map.mjs", "--check"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});
