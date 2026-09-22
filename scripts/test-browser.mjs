#!/usr/bin/env node
/**
 * Run the browser suites against a freshly built server.
 *
 * Starts `next start` on a port of its own with a throwaway data directory,
 * so a run never touches whatever database is in use, waits for it, runs each
 * suite, and stops the server whatever happens.
 *
 *   npm run test:browser          all suites
 *   npm run test:browser -- lang  suites whose filename contains "lang"
 */
import { spawn, spawnSync } from "node:child_process";
import { readdirSync, rmSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = Number(process.env.SPIR_TEST_PORT ?? 3399);
const URL_ = `http://localhost:${PORT}`;
const filter = process.argv[2] ?? "";

const suites = readdirSync("tests/browser")
  .filter((f) => f.endsWith(".mjs") && f !== "harness.mjs")
  .filter((f) => !filter || f.includes(filter))
  .sort();

if (suites.length === 0) {
  console.error(`No suite matches "${filter}".`);
  process.exit(1);
}

if (process.env.SPIR_TEST_SKIP_BUILD !== "1") {
  console.log("building…");
  const built = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

// Something already answering on the port would be tested INSTEAD of the
// server started below — with its own build and its own data — and every
// result would be about the wrong program. Refuse rather than guess.
try {
  await fetch(`${URL_}/welcome`, { signal: AbortSignal.timeout(2000) });
  console.error(`Port ${PORT} is already in use. Stop whatever is serving ${URL_} (or set SPIR_TEST_PORT) and run again.`);
  process.exit(1);
} catch {
  /* free — good */
}

// A data directory of its own, so a test run cannot disturb real data.
const dataDir = mkdtempSync(join(tmpdir(), "spir-browser-test-"));
// Its own process group: `npm start` runs next-server as a CHILD, and killing
// only npm used to leave that child alive, still holding the port, to be
// silently tested by the next run.
const server = spawn("npm", ["start"], {
  env: { ...process.env, PORT: String(PORT), PGLITE_DATA_DIR: dataDir },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
// Keep the server's output. A suite that fails for a server-side reason —
// a 500 from a route — leaves nothing to look at otherwise, which is exactly
// the case where the log is the only evidence.
let serverLog = "";
const keep = (d) => {
  serverLog += d;
  if (process.env.SPIR_TEST_VERBOSE === "1") process.stdout.write(d);
};
server.stdout.on("data", keep);
server.stderr.on("data", keep);

const stop = () => {
  try {
    process.kill(-server.pid, "SIGKILL"); // the whole group: npm and next-server
  } catch {
    server.kill("SIGKILL");
  }
  rmSync(dataDir, { recursive: true, force: true });
};
process.on("exit", stop);
process.on("SIGINT", () => { stop(); process.exit(130); });

async function waitForServer(timeoutMs = 300_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    if (server.exitCode !== null) throw new Error(`server exited:\n${serverLog}`);
    try {
      const res = await fetch(`${URL_}/welcome`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`server did not start within ${timeoutMs / 1000}s:\n${serverLog}`);
}

console.log(`starting a server on ${URL_} …`);
await waitForServer();
console.log("server up\n");

let failed = 0;
for (const suite of suites) {
  console.log(`── ${suite} ${"─".repeat(Math.max(0, 56 - suite.length))}`);
  const r = spawnSync("node", [join("tests/browser", suite)], {
    stdio: "inherit",
    env: { ...process.env, SPIR_TEST_URL: URL_ },
  });
  if (r.status !== 0) {
    failed++;
    const tail = serverLog.split("\n").slice(-40).join("\n").trim();
    if (tail) console.log(`\n--- server output while ${suite} ran ---\n${tail}\n---`);
  }
  serverLog = "";
  console.log();
}

stop();
console.log(failed === 0 ? `all ${suites.length} suites passed` : `${failed} of ${suites.length} suites failed`);
process.exit(failed === 0 ? 0 : 1);
