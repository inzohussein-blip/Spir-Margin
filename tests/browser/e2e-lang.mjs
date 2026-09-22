import { H, SHOT, launch, signIn } from "./harness.mjs";


const results = [];
const check = (n, p, d = "") => {
  results.push({ n, p });
  console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

// Arabic-Indic digits ٠١٢٣٤٥٦٧٨٩ and the Persian variants ۰۱۲۳۴۵۶۷۸۹.
const ARABIC_INDIC = /[٠-٩۰-۹]/;

const browser = await launch();

// A browser whose locale IS Arabic — the case that would have produced ١٢٣٤.
const ctx = await browser.newContext({
  locale: "ar-EG",
  timezoneId: "Asia/Baghdad",
});
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));

async function auditDigits(path, label) {
  await page.goto(H + path, { waitUntil: "networkidle", timeout: 180000 });
  const text = await page.evaluate(() => document.body.innerText);
  const bad = text.match(new RegExp(`[^\\n]*[٠-٩۰-۹][^\\n]*`, "g"));
  check(`${label}: digits are 1234, not ١٢٣٤`, !ARABIC_INDIC.test(text),
    bad ? bad.slice(0, 2).join(" / ") : "");
  return text;
}

// Sign in with the built-in account.
await page.goto(H + "/login", { waitUntil: "networkidle", timeout: 180000 });
const signin = await page.evaluate(() => document.body.innerText);
check("sign-in is Arabic", signin.includes("تسجيل الدخول") || signin.includes("الحساب المدمج"));
check("sign-in has no Arabic-Indic digits", !ARABIC_INDIC.test(signin));

await page.fill('input[name="email"]', "admin@spir.local");
await page.fill('input[name="password"]', "123");
await page.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180000 }).catch(() => {});
await page.waitForLoadState("networkidle").catch(() => {});

// The language switcher must be gone from the app shell.
const dash = await page.evaluate(() => document.body.innerText);
check("dashboard is Arabic", dash.includes("لوحة التحكم"));
const switcher = await page.locator('button[title*="English"], button[title*="العربية"]').count();
check("language switcher is not rendered", switcher === 0, `found ${switcher}`);
const hasEnToggle = /\bEN\b/.test(dash) && dash.includes("ع");
check("no EN/ع toggle text in the shell", !(await page.locator("text=/^(EN|ع)$/").count()));

// Digits on pages that show money, counts and dates.
await auditDigits("/", "dashboard");
await auditDigits("/labs", "labs");
await auditDigits("/devices", "devices");
await auditDigits("/kits", "kits");
await auditDigits("/sales", "sales");

// The html element must be Arabic + RTL.
const langDir = await page.evaluate(() => [
  document.documentElement.lang,
  document.documentElement.dir,
]);
check("html lang=ar dir=rtl", langDir[0] === "ar" && langDir[1] === "rtl", langDir.join(" "));

// Forcing the old English cookie must NOT switch the UI.
await ctx.addCookies([{ name: "spir_locale", value: "en", url: H }]);
await page.goto(H + "/", { waitUntil: "networkidle", timeout: 120000 });
const forced = await page.evaluate(() => document.body.innerText);
check("spir_locale=en is ignored, UI stays Arabic", forced.includes("لوحة التحكم"));
check("still no Arabic-Indic digits with the en cookie", !ARABIC_INDIC.test(forced));
await page.screenshot({ path: `${SHOT}/lang-dashboard.png` });

check("no uncaught page errors", errs.length === 0, errs.join(" | "));

await browser.close();
const failed = results.filter((r) => !r.p);
console.log(`\n${results.length - failed.length}/${results.length} language checks passed`);
process.exit(failed.length ? 1 : 0);
