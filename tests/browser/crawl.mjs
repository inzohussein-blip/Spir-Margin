import { H, HERE, SHOT, launch } from "./harness.mjs";
import fs from "node:fs";

const routes = fs.readFileSync(`${HERE}/routes.txt`, "utf8").trim().split("\n");

const ARABIC_INDIC = /[٠-٩۰-۹]/;
// Latin words that leak into an Arabic-only UI. Ignore brand/product/code-ish
// tokens which are legitimately Latin (Spir-Margin, LAB-001, USD, IQD, CSV…).
const IGNORE = /Spir-Margin|Administrator|USD|IQD|CSV|PDF|API|URL|ID|QR|SKU|UOM|BOM|RFQ|POS|AMC|LAB-|DEMO|DEV-|KIT-|SPR-|PO-|SI-|PICK-|TRIP-|Demo |Dr\.|Baghdad|Basra|Germany|Nos|Box|⌘K|EN/g;

const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const findings = [];
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push({ url: page.url(), msg: String(e).slice(0, 220) }));
// Moving to the next route cancels the previous page's link prefetches, and
// Next reports each cancelled one as a console error. That is the crawler's
// own doing, not the app's — counting it once hid a real 404 among five of
// these on the dashboard.
const PREFETCH_CANCELLED = /Failed to fetch RSC payload .* Falling back to browser navigation/;
page.on("console", (m) => {
  if (m.type() === "error" && !PREFETCH_CANCELLED.test(m.text()))
    consoleErrors.push({ url: page.url(), msg: m.text().slice(0, 220) });
});

// Sign in once with the built-in account.
await page.goto(H + "/login", { waitUntil: "networkidle", timeout: 180000 });
await page.fill('input[name="email"]', "admin@spir.local");
await page.fill('input[name="password"]', "123");
await page.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180000 }).catch(() => {});
await page.waitForLoadState("networkidle").catch(() => {});
console.log("signed in\n");

let i = 0;
for (const route of routes) {
  i++;
  const before = consoleErrors.length;
  let status = 0;
  try {
    const res = await page.goto(H + route, { waitUntil: "domcontentloaded", timeout: 60000 });
    status = res?.status() ?? 0;
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  } catch (e) {
    findings.push({ route, kind: "NAV_FAIL", detail: String(e).slice(0, 160) });
    continue;
  }

  // File names, commands and keys are shown in <code>/<kbd> — Latin by
  // nature, and not untranslated UI. They are left out of the text checked.
  const text = await page
    .evaluate(() => {
      let s = document.body.innerText;
      for (const e of document.querySelectorAll("code, kbd")) {
        const inner = e.innerText;
        if (inner) s = s.split(inner).join(" ");
      }
      return s;
    })
    .catch(() => "");
  const issues = [];

  if (status >= 400) issues.push(`HTTP ${status}`);
  if (text.includes("حدث خطأ ما")) issues.push("ERROR_BOUNDARY");
  if (text.includes("404") && text.includes("could not be found")) issues.push("NOT_FOUND");
  if (ARABIC_INDIC.test(text)) issues.push("ARABIC_INDIC_DIGITS");
  if (text.trim().length < 40) issues.push("NEARLY_EMPTY");

  // Untranslated Latin prose still showing in the Arabic UI.
  const latin = text.replace(IGNORE, "").match(/\b[A-Za-z][A-Za-z'’]{3,}(?:\s+[A-Za-z][A-Za-z'’]{2,}){0,6}\b/g);
  const latinPhrases = [...new Set((latin ?? []).filter((s) => s.length > 6))];
  if (latinPhrases.length) issues.push(`LATIN:${latinPhrases.slice(0, 5).join(" | ")}`);

  // The check above skips short words, which is exactly where column headers
  // ("Qty", "Due", "Ref") and dropdown prompts hide — and a dropdown's options
  // are not in innerText at all. So headers and prompt options are checked
  // one by one, with no length threshold.
  const labels = await page
    .evaluate(() => [
      ...[...document.querySelectorAll("th")].map((e) => e.innerText),
      ...[...document.querySelectorAll('option[value=""], option[disabled]')].map((e) => e.textContent ?? ""),
    ])
    .catch(() => []);
  const latinLabels = [...new Set(labels.map((l) => l.replace(IGNORE, "").trim()).filter((l) => /[A-Za-z]{2,}/.test(l)))];
  if (latinLabels.length) issues.push(`LATIN_LABEL:${latinLabels.slice(0, 5).join(" | ")}`);

  const newErrs = consoleErrors.length - before;
  if (newErrs > 0) issues.push(`CONSOLE_ERRORS:${newErrs}`);

  if (issues.length) findings.push({ route, kind: "ISSUES", detail: issues.join(" ; ") });
  process.stdout.write(`\r[${i}/${routes.length}] ${route}`.padEnd(70));
}

console.log("\n");
fs.writeFileSync(`${SHOT}/crawl-findings.json`, JSON.stringify({ findings, consoleErrors }, null, 2));

const byKind = {};
for (const f of findings) {
  const tag = f.detail.split(" ; ")[0].split(":")[0];
  (byKind[tag] ??= []).push(f.route);
}
console.log("=== SUMMARY ===");
for (const [k, v] of Object.entries(byKind).sort((a, b) => b[1].length - a[1].length)) {
  console.log(`${String(v.length).padStart(3)}  ${k}`);
}
console.log(`\ntotal routes with findings: ${findings.length}/${routes.length}`);
console.log(`total console errors: ${consoleErrors.length}`);

await browser.close();
