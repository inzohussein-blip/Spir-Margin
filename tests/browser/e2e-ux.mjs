import { H, SHOT, launch, signIn } from "./harness.mjs";


const results = [];
const check = (n, p, d = "") => {
  results.push({ n, p });
  console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const browser = await launch();

async function enter(ctx) {
  const p = await ctx.newPage();
  await p.goto(H + "/login", { waitUntil: "networkidle", timeout: 180000 });
  await p.fill('input[name="email"]', "admin@spir.local");
  await p.fill('input[name="password"]', "123");
  await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180000 }).catch(() => {});
  await p.waitForLoadState("networkidle").catch(() => {});
  return p;
}

// ── 1. Mobile tables become labelled cards ───────────────────────────
{
  const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 390, height: 844 } });
  const p = await enter(ctx);
  await p.goto(H + "/labs", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(900);

  const labelled = await p.locator("table[data-labelled]").count();
  check("1a mobile table is labelled", labelled > 0);

  const cellInfo = await p.evaluate(() => {
    const td = document.querySelector("[data-desk-list] table tbody td");
    if (!td) return null;
    const cs = getComputedStyle(td);
    const before = getComputedStyle(td, "::before");
    return { display: cs.display, label: td.getAttribute("data-label"), beforeContent: before.content };
  });
  check("1b cells render as flex rows", cellInfo?.display === "flex", cellInfo?.display);
  check("1c cells carry their column label", !!cellInfo?.label, cellInfo?.label ?? "");
  check("1d label is painted via ::before", (cellInfo?.beforeContent ?? "none") !== "none");

  // No cell may be clipped horizontally any more.
  const clipped = await p.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-desk-list] table tbody tr")];
    return rows.filter((r) => r.scrollWidth - r.clientWidth > 2).length;
  });
  check("1e no row overflows its card", clipped === 0, `${clipped} clipped`);
  await p.screenshot({ path: `${SHOT}/fix-m-labs.png` });
  await ctx.close();
}

// ── 2. Date inputs read yyyy-mm-dd ───────────────────────────────────
{
  const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1440, height: 900 } });
  const p = await enter(ctx);
  await p.goto(H + "/devices/new", { waitUntil: "networkidle", timeout: 120000 });
  const langs = await p.evaluate(() =>
    [...document.querySelectorAll('input[type="date"]')].map((i) => i.getAttribute("lang")),
  );
  check("2a every date input pins its language", langs.length > 0 && langs.every((l) => l === "en-CA"),
    JSON.stringify(langs));
  await p.screenshot({ path: `${SHOT}/fix-d-device-form.png` });
  await ctx.close();
}

// ── 3. Master data is Arabic ─────────────────────────────────────────
{
  const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1440, height: 900 } });
  const p = await enter(ctx);
  await p.goto(H + "/accounts", { waitUntil: "networkidle", timeout: 120000 });
  const txt = await p.evaluate(() => document.body.innerText);
  check("3a chart of accounts is Arabic", txt.includes("الذمم المدينة") && txt.includes("المصروفات"));
  check("3b no English account names remain",
    !txt.includes("Accounts Receivable") && !txt.includes("Bank Charges") && !txt.includes("Application of Funds"));
  await p.screenshot({ path: `${SHOT}/fix-d-accounts.png` });
  await ctx.close();
}

// ── 4. Empty states offer the create action ──────────────────────────
{
  const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1440, height: 900 } });
  const p = await enter(ctx);
  await p.goto(H + "/opportunities", { waitUntil: "networkidle", timeout: 120000 });
  const txt = await p.evaluate(() => document.body.innerText);
  const hasEmpty = txt.includes("لا ");
  const actionInEmpty = await p.locator('a[href="/opportunities/new"]').count();
  check("4a empty list offers a create action", !hasEmpty || actionInEmpty >= 2,
    `empty=${hasEmpty} links=${actionInEmpty}`);
  await p.screenshot({ path: `${SHOT}/fix-d-empty.png` });
  await ctx.close();
}

// ── 5. Saving raises a confirmation toast ────────────────────────────
{
  const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1440, height: 900 } });
  const p = await enter(ctx);
  await p.goto(H + "/labs/new", { waitUntil: "networkidle", timeout: 120000 });
  await p.fill('input[name="code"]', "LAB-TST");
  await p.fill('input[name="name"]', "مختبر اختبار");
  // The header's logout form is the first submit on the page — scope to the
  // form that actually holds the fields we just filled.
  await p.locator('form:has(input[name="code"]) button[type="submit"]').first().click();
  await p.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const toast = await p.locator("[data-sonner-toast]").count();
  check("5a a toast confirms the save", toast > 0, `${toast} toasts`);
  const urlClean = !p.url().includes("saved=");
  check("5b the marker is stripped from the URL", urlClean, p.url());
  await p.screenshot({ path: `${SHOT}/fix-d-toast.png` });
  await ctx.close();
}

// ── 6. Density toggle ────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1440, height: 900 } });
  const p = await enter(ctx);
  await p.goto(H + "/labs", { waitUntil: "networkidle", timeout: 120000 });
  const before = await p.evaluate(() =>
    getComputedStyle(document.querySelector("[data-desk-list] table tbody td")).paddingTop);
  await p.locator('button[aria-pressed]').first().click();
  await p.waitForTimeout(400);
  const after = await p.evaluate(() =>
    getComputedStyle(document.querySelector("[data-desk-list] table tbody td")).paddingTop);
  check("6a toggling changes row density", before !== after, `${before} -> ${after}`);
  const attr = await p.evaluate(() => document.documentElement.getAttribute("data-density"));
  check("6b density is recorded on <html>", attr === "compact", String(attr));

  // It must survive a reload.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const persisted = await p.evaluate(() => document.documentElement.getAttribute("data-density"));
  check("6c density persists across reloads", persisted === "compact", String(persisted));
  await ctx.close();
}

// ── 7. Skeletons match their page type ───────────────────────────────
{
  const fs = await import("node:fs");
  const list = fs.readFileSync("/home/user/Spir-Margin/src/app/labs/loading.tsx", "utf8");
  const form = fs.readFileSync("/home/user/Spir-Margin/src/app/labs/new/loading.tsx", "utf8");
  check("7a list pages get the list skeleton", list.includes("ListSkeleton"));
  check("7b form pages get the form skeleton", form.includes("FormSkeleton"));
}

await browser.close();
const failed = results.filter((r) => !r.p);
console.log(`\n${results.length - failed.length}/${results.length} UI/UX checks passed`);
process.exit(failed.length ? 1 : 0);
