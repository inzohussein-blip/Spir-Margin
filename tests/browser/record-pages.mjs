// The pages behind a record (runs after the e2e suites, which create the
// records): for every list in routes.txt, open the first
// record it links to and, where there is one, its print page — and check
// them the way crawl.mjs checks the lists (error screen, untranslated Latin
// text, Arabic-Indic digits, console errors). crawl.mjs cannot reach these:
// their addresses carry a record id.
import fs from "node:fs";
import { H, HERE, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("record pages");
const lists = fs
  .readFileSync(`${HERE}/routes.txt`, "utf8")
  .trim()
  .split("\n")
  .filter((r) => r !== "/" && !r.includes("?") && !r.endsWith("/new"));

const ARABIC_INDIC = /[٠-٩۰-۹]/;
// Same allowance as crawl.mjs, plus the Latin that a record legitimately
// carries: codes, serial numbers, e-mail addresses, the demo's Latin names.
const IGNORE = /Spir-Margin|Administrator|USD|IQD|CSV|PDF|API|URL|ID|QR|SKU|UOM|BOM|RFQ|POS|AMC|LAB-|DEMO|DEV-|KIT-|SPR-|PO-|SI-|PICK-|TRIP-|Demo |Dr\.|Baghdad|Basra|Germany|Tailscale|Nos|Box|⌘K|EN|[\w.+-]+@[\w.-]+|\b[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g;
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const PREFETCH_CANCELLED = /Failed to fetch RSC payload .* Falling back to browser navigation/;

const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1440, height: 900 } });
ctx.setDefaultTimeout(60_000);
const page = await signIn(ctx);
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push(String(e).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() === "error" && !PREFETCH_CANCELLED.test(m.text())) consoleErrors.push(m.text().slice(0, 200));
});

async function inspect(url) {
  const before = consoleErrors.length;
  let status = 0;
  try {
    const res = await page.goto(H + url, { waitUntil: "domcontentloaded" });
    status = res?.status() ?? 0;
    await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  } catch (e) {
    return [`NAV_FAIL ${String(e).slice(0, 120)}`];
  }
  const text = await page
    .evaluate(() => {
      let s = document.body.innerText;
      for (const e of document.querySelectorAll("code, kbd, [dir=ltr]")) {
        const inner = e.innerText;
        if (inner) s = s.split(inner).join(" ");
      }
      return s;
    })
    .catch(() => "");
  const issues = [];
  if (status >= 400) issues.push(`HTTP ${status}`);
  if (text.includes("حدث خطأ ما")) issues.push("ERROR_BOUNDARY");
  if (ARABIC_INDIC.test(text)) issues.push("ARABIC_INDIC_DIGITS");
  const latin = text.replace(IGNORE, "").match(/\b[A-Za-z][A-Za-z'’]{3,}(?:\s+[A-Za-z][A-Za-z'’]{2,}){0,6}\b/g);
  const phrases = [...new Set((latin ?? []).filter((s) => s.length > 6))];
  if (phrases.length) issues.push(`LATIN: ${phrases.slice(0, 5).join(" | ")}`);
  const labels = await page
    .evaluate(() => [...document.querySelectorAll("th, label > span:first-child, dt")].map((e) => e.innerText))
    .catch(() => []);
  const latinLabels = [...new Set(labels.map((l) => l.replace(IGNORE, "").trim()).filter((l) => /[A-Za-z]{2,}/.test(l)))];
  if (latinLabels.length) issues.push(`LATIN_LABEL: ${latinLabels.slice(0, 5).join(" | ")}`);
  if (consoleErrors.length > before) issues.push(`CONSOLE: ${consoleErrors.slice(before, before + 2).join(" | ")}`);
  return issues;
}

let visited = 0;
for (const list of lists) {
  await page.goto(H + list, { waitUntil: "domcontentloaded" }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => {});
  const re = new RegExp(`^${list.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/${UUID}$`);
  const href = await page
    .evaluate((src) => {
      const r = new RegExp(src);
      return [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")).find((h) => h && r.test(h)) ?? null;
    }, re.source)
    .catch(() => null);
  if (!href) continue;
  for (const url of [href, `${href}/print`]) {
    if (url.endsWith("/print")) {
      const head = await page.request.get(H + url, { maxRedirects: 0 }).catch(() => null);
      if (!head || head.status() === 404) continue;
    }
    visited++;
    const issues = await inspect(url);
    check(`${url.replace(new RegExp(UUID), "[id]")} shows cleanly`, issues.length === 0, issues.join(" ; "));
  }
}
check("record pages were found to visit", visited >= 6, `${visited} visited`);

await browser.close();
done();
