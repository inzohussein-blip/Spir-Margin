// The install button. `beforeinstallprompt` fires once, early, and only
// outside incognito — so this suite needs a persistent profile, which is why
// it launches its own browser instead of using the shared harness launch().
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { H, SHOT, ACCOUNT, results } from "./harness.mjs";

const { check, done } = results("install");

let chromium;
try {
  ({ chromium } = await import("playwright-core"));
} catch {
  console.log("SKIP  playwright-core is not installed");
  process.exit(0);
}

const profile = mkdtempSync(join(tmpdir(), "spir-install-"));
const ctx = await chromium.launchPersistentContext(profile, {
  ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  locale: "ar-EG",
  viewport: { width: 1280, height: 1100 },
});

const p = await ctx.newPage();
await p.goto(H + "/login", { waitUntil: "domcontentloaded", timeout: 180000 });
await p.fill('input[name="email"]', ACCOUNT.email);
await p.fill('input[name="password"]', ACCOUNT.password);
await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180000 }).catch(() => {});

// Chromium's own verdict, which is the thing that actually decides.
const cdp = await ctx.newCDPSession(p);
await cdp.send("Page.enable");
const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors");
check("the browser reports no reason it cannot be installed", installabilityErrors.length === 0,
  JSON.stringify(installabilityErrors));

await p.goto(H + "/settings", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForTimeout(6000);

const text = await p.locator("body").innerText();
check("settings offers installing as an app", text.includes("التثبيت كتطبيق"));
check("it explains the app still runs from this computer", text.includes("ما يزال يعمل من هذا الحاسوب"));
check("no Arabic-Indic digits", !/[٠-٩]/.test(text));

// The early capture must have parked the event before React hydrated.
const captured = await p.evaluate(() => !!window.__spirInstall);
check("the install offer was captured before hydration", captured);

const btn = p.getByRole("button", { name: "تثبيت التطبيق" });
check("a live install button is shown", (await btn.count()) === 1);
check("and it is not the fallback instructions", !text.includes("لا يوفّر تثبيتاً بنقرة واحدة"));

await p.screenshot({ path: `${SHOT}/install.png`, fullPage: true });
done();
await ctx.close();
rmSync(profile, { recursive: true, force: true });
