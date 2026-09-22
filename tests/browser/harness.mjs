// Shared setup for the browser suites.
//
// These run against a real build in a real browser, which is how several
// defects in this app were found that no unit test could reach: an Arabic
// column collapsing in RTL, a platform picker that did nothing, a save that
// crashed into the error boundary. They need a running server, so they are
// not part of `npm test` — see `npm run test:browser`.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const HERE = dirname(fileURLToPath(import.meta.url));

/** The server to test. Start one yourself, or use `npm run test:browser`. */
export const H = process.env.SPIR_TEST_URL ?? "http://localhost:3320";

/** Where screenshots land. Ignored by git. */
export const SHOT = process.env.SPIR_TEST_ARTIFACTS ?? join(HERE, "artifacts");
mkdirSync(SHOT, { recursive: true });

/** The built-in account, which works with no database and no network. */
export const ACCOUNT = { email: "admin@spir.local", password: "123" };

/**
 * Chromium. Honours PLAYWRIGHT_CHROMIUM (or a system install) and otherwise
 * lets Playwright find its own, so this is not tied to one machine's layout.
 */
export async function launch() {
  let chromium;
  try {
    ({ chromium } = await import("playwright-core"));
  } catch {
    console.log("SKIP  playwright-core is not installed (npm i -D playwright-core)");
    process.exit(0);
  }
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM || undefined;
  return chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

/** A signed-in page. Sign-in is the same on every suite, so it lives here. */
export async function signIn(ctx) {
  const p = await ctx.newPage();
  await p.goto(H + "/login", { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.fill('input[name="email"]', ACCOUNT.email);
  await p.fill('input[name="password"]', ACCOUNT.password);
  await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180000 }).catch(() => {});
  await p.waitForLoadState("networkidle").catch(() => {});
  return p;
}

/** Tally that prints a summary and sets the exit code. */
export function results(name) {
  const all = [];
  return {
    check(label, ok, detail = "") {
      all.push(ok);
      console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? "  — " + detail : ""}`);
    },
    done() {
      const passed = all.filter(Boolean).length;
      console.log(`\n${passed}/${all.length} ${name} checks passed`);
      if (passed !== all.length) process.exitCode = 1;
    },
  };
}
