// The Windows updater (scripts/windows/update.ps1), run for real.
//
// PowerShell exists outside Windows too (GitHub's Linux runners carry pwsh),
// so the updater's own logic runs here against a folder laid out like an
// installed program and a fake release server. What only Windows has —
// stopping and starting the server, npm — is replaced by stand-ins after the
// script is loaded; everything else (asking for the release, downloading,
// unpacking, the swap, going back when the new version does not start) is
// the script's own code.
//
// Skipped when no pwsh is found (PWSH=/path/to/pwsh to point at one).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function findPwsh() {
  for (const p of [process.env.PWSH, "pwsh"].filter(Boolean)) {
    try {
      execFileSync(p, ["-NoProfile", "-Command", "1"], { stdio: "ignore" });
      return p;
    } catch {
      /* not this one */
    }
  }
  return null;
}
const PWSH = findPwsh();
const skip = PWSH ? false : "pwsh is not installed";

function run(script) {
  return new Promise((resolve, reject) => {
    execFile(PWSH, ["-NoProfile", "-NonInteractive", "-Command", script], { timeout: 120_000 }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${err.message}\n${stdout}\n${stderr}`));
      else resolve(stdout);
    });
  });
}

const write = (file, text) => {
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, text);
};
const read = (file) => readFileSync(file, "utf8");
const json = (file) => JSON.parse(read(file).replace(/^\ufeff/, ""));

/** An installed program at release `number`, with data and settings of its own. */
function installedApp(root, number) {
  const app = join(root, "app");
  cpSync("scripts/windows/update.ps1", join(app, "scripts/windows/update.ps1"));
  write(join(app, "version.json"), `﻿{"number":${number},"commit":"old","date":"2026-01-01"}`);
  write(join(app, "package.json"), '{"name":"old"}');
  write(join(app, "src/page.txt"), "old page");
  write(join(app, ".next/BUILD_ID"), "old build");
  write(join(app, ".pglite-data/PG_VERSION"), "the company's data");
  write(join(app, ".env.local"), "AUTH_SECRET=the-real-key\n");
  write(join(app, "backups/b.tar.gz"), "a backup");
  write(join(app, "RESET-ADMIN-PASSWORD.txt"), "");
  return app;
}

/** Release `number` as the release workflow packs it: one top folder, spir-margin/. */
async function releaseZip(root, number) {
  const dir = join(root, "rel", "spir-margin");
  write(join(dir, "version.json"), `{"number":${number},"commit":"new","date":"2026-02-02"}`);
  write(join(dir, "package.json"), '{"name":"new"}');
  write(join(dir, "src/page.txt"), "new page");
  write(join(dir, "scripts/windows/update.ps1"), "# new updater");
  const zip = join(root, "spir-margin.zip");
  await run(`Compress-Archive -Path '${dir}' -DestinationPath '${zip}' -Force`);
  return zip;
}

/** GitHub's releases API and download, for one release. */
async function fakeGitHub(number, zipFile) {
  const server = createServer((req, res) => {
    const base = `http://127.0.0.1:${server.address().port}`;
    if (req.url === "/repos/acme/spir/releases/latest") {
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({
        tag_name: `build-${number}`, draft: false, prerelease: false, published_at: "2026-02-02T10:00:00Z",
        assets: [{ name: "spir-margin.zip", browser_download_url: `${base}/download/spir-margin.zip` }],
      }));
    } else if (req.url === "/download/spir-margin.zip") {
      res.end(readFileSync(zipFile));
    } else {
      res.statusCode = 404;
      res.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { api: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

/** Load the updater from the installed copy, with Windows-only steps stood in for. */
function updater(app, api, { starts }) {
  return `
    $ErrorActionPreference = "Stop"
    . '${join(app, "scripts/windows/update.ps1")}' -Repo acme/spir -Api '${api}' -Quiet
    function Get-ServerArgs { [pscustomobject]@{ Port = 3999; Host = "127.0.0.1" } }
    function Stop-Server([int]$port) { Add-Content -LiteralPath (Join-Path $UpdatesDir "calls.txt") "stop" }
    function Start-Server($srv) { Add-Content -LiteralPath (Join-Path $UpdatesDir "calls.txt") "start" }
    function Wait-Answer([int]$port, [int]$seconds) { return $${starts ? "true" : "false"} }
    function Invoke-Npm([string]$dir, [string]$npmArgs) {
      if ($npmArgs -eq "run build") {
        New-Item -ItemType Directory (Join-Path $dir ".next") -Force | Out-Null
        Set-Content (Join-Path $dir ".next/BUILD_ID") "new build"
        # A build writes a key and a database of its own; neither may reach the program.
        Set-Content (Join-Path $dir ".env.local") "AUTH_SECRET=a-new-key"
        New-Item -ItemType Directory (Join-Path $dir ".pglite-data") -Force | Out-Null
        Set-Content (Join-Path $dir ".pglite-data/PG_VERSION") "empty stage data"
      }
    }
    Main
  `;
}

test("the updater parses as PowerShell", { skip }, async () => {
  const out = await run(`
    $e = $null; $t = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile('${join(process.cwd(), "scripts/windows/update.ps1")}', [ref]$t, [ref]$e)
    $e.Count`);
  assert.equal(out.trim(), "0");
});

test("an update swaps the program's files and leaves its data, settings and backups alone", { skip }, async () => {
  const root = mkdtempSync(join(tmpdir(), "spir-upd-"));
  const zip = await releaseZip(root, 5);
  const gh = await fakeGitHub(5, zip);
  try {
    const app = installedApp(root, 3);
    await run(updater(app, gh.api, { starts: true }));

    const status = json(join(app, "updates/status.json"));
    assert.equal(status.state, "done", status.detail);
    assert.equal(status.number, 5);
    assert.equal(json(join(app, "version.json")).number, 5);
    assert.equal(read(join(app, "src/page.txt")), "new page");
    assert.match(read(join(app, ".next/BUILD_ID")), /new build/);
    assert.equal(read(join(app, ".pglite-data/PG_VERSION")), "the company's data");
    assert.equal(read(join(app, ".env.local")), "AUTH_SECRET=the-real-key\n");
    assert.equal(read(join(app, "backups/b.tar.gz")), "a backup");
    assert.ok(existsSync(join(app, "RESET-ADMIN-PASSWORD.txt")), "a file the release does not carry stays");
    assert.deepEqual(read(join(app, "updates/calls.txt")).trim().split(/\r?\n/), ["stop", "start"]);
    // The copy of the data taken before the switch is kept; the work folders are not.
    assert.equal(read(join(app, "updates/data-before-update/PG_VERSION")), "the company's data");
    assert.ok(!existsSync(join(app, "updates/stage-5")) && !existsSync(join(app, "updates/previous-5")));
    assert.ok(!existsSync(join(app, "updates/update.lock")));
  } finally {
    gh.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a release that does not start is undone: old files and the data as they were", { skip }, async () => {
  const root = mkdtempSync(join(tmpdir(), "spir-upd-"));
  const zip = await releaseZip(root, 6);
  const gh = await fakeGitHub(6, zip);
  try {
    const app = installedApp(root, 3);
    // What a failed first start may leave behind in the database.
    const script = updater(app, gh.api, { starts: false }).replace(
      "function Wait-Answer([int]$port, [int]$seconds) { return $false }",
      // Only the new release's start does that; the old one's, after going back, is left alone.
      `function Wait-Answer([int]$port, [int]$seconds) {
         $script:starts++
         if ($script:starts -eq 1) { Set-Content -LiteralPath (Join-Path $DataDir "PG_VERSION") "half-migrated" -NoNewline }
         return $false }`,
    );
    await run(script);

    const status = json(join(app, "updates/status.json"));
    assert.equal(status.state, "rolledback");
    assert.equal(json(join(app, "version.json")).number, 3);
    assert.equal(read(join(app, "src/page.txt")), "old page");
    assert.equal(read(join(app, ".next/BUILD_ID")), "old build");
    assert.equal(read(join(app, "package.json")), '{"name":"old"}');
    assert.equal(read(join(app, ".pglite-data/PG_VERSION")), "the company's data");
    assert.equal(read(join(app, ".env.local")), "AUTH_SECRET=the-real-key\n");
    assert.deepEqual(read(join(app, "updates/calls.txt")).trim().split(/\r?\n/), ["stop", "start", "stop", "start"]);
  } finally {
    gh.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("already on the newest release: nothing is downloaded or stopped", { skip }, async () => {
  const root = mkdtempSync(join(tmpdir(), "spir-upd-"));
  const zip = await releaseZip(root, 4);
  const gh = await fakeGitHub(4, zip);
  try {
    const app = installedApp(root, 4);
    await run(updater(app, gh.api, { starts: true }));
    assert.equal(json(join(app, "updates/status.json")).state, "uptodate");
    assert.ok(!existsSync(join(app, "updates/calls.txt")));
    assert.equal(read(join(app, "src/page.txt")), "old page");
  } finally {
    gh.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test("a failed build leaves the running program untouched", { skip }, async () => {
  const root = mkdtempSync(join(tmpdir(), "spir-upd-"));
  const zip = await releaseZip(root, 7);
  const gh = await fakeGitHub(7, zip);
  try {
    const app = installedApp(root, 3);
    const script = updater(app, gh.api, { starts: true }).replace(
      /function Invoke-Npm\(\[string\]\$dir, \[string\]\$npmArgs\) \{/,
      `function Invoke-Npm([string]$dir, [string]$npmArgs) { if ($npmArgs -eq "run build") { throw "npm run build failed (exit 1)" }`,
    );
    await run(script);
    const status = json(join(app, "updates/status.json"));
    assert.equal(status.state, "failed");
    assert.equal(status.number, 7);
    assert.match(status.detail, /build failed/);
    assert.ok(!existsSync(join(app, "updates/calls.txt")), "the program was never stopped");
    assert.equal(read(join(app, "src/page.txt")), "old page");
    assert.ok(!existsSync(join(app, "updates/update.lock")));
  } finally {
    gh.close();
    rmSync(root, { recursive: true, force: true });
  }
});
