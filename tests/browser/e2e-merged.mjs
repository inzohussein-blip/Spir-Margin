import { H, SHOT, launch, signIn } from "./harness.mjs";
const r = [];
const check = (n, ok, d = "") => { r.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };

const b = await launch();
const ctx = await b.newContext({ locale: "ar-EG", viewport: { width: 1280, height: 1000 } });
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", e => errs.push(String(e).slice(0,140)));

// 1. Welcome screen is the landing page, and it is a welcome — not a picker.
await p.goto(H + "/welcome", { waitUntil: "networkidle", timeout: 180000 });
const wt = await p.locator("body").innerText();
check("1a welcome page renders", wt.length > 200);
check("1b it is not a platform picker", !wt.includes("اختر نوع المنصّة") && !wt.includes("منصّة مربوطة"), );
check("1c it states where data lives", wt.includes("محفوظ على هذا الحاسوب"));
check("1d it says it works with no database", wt.includes("يعمل بلا قاعدة بيانات"));
check("1e it says it works with no internet", wt.includes("يعمل بلا إنترنت"));
check("1f no Latin leakage in body copy", !/\b(platform|database|Sign in)\b/.test(wt), wt.match(/\b(platform|database|Sign in)\b/)?.[0] ?? "");
await p.screenshot({ path: `${SHOT}/merged-welcome.png`, fullPage: true });

// 2. Protected route sends you to sign-in, not to a picker.
await p.goto(H + "/labs", { waitUntil: "networkidle", timeout: 120000 });
check("2a protected route redirects to login", new URL(p.url()).pathname === "/login", p.url());

// 3. Sign-in shows the built-in account and accepts it with no database configured.
const lt = await p.locator("body").innerText();
check("3a login shows the built-in account", lt.includes("الحساب المدمج"));
check("3b it shows the fixed email", lt.includes("admin@spir.local"));
await p.fill('input[name="email"]', "admin@spir.local");
await p.fill('input[name="password"]', "123");
await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await p.waitForURL(u => !u.pathname.startsWith("/login"), { timeout: 120000 }).catch(()=>{});
check("3c signing in lands in the app", new URL(p.url()).pathname === "/labs", p.url());

// 4. The header reports that this machine is standalone (no DATABASE_URL here).
await p.waitForTimeout(2500);
const ht = await p.locator("header").innerText();
check("4a header shows the standalone state", ht.includes("هذا الحاسوب فقط"), ht.replace(/\n/g," ").slice(0,90));

// 5. Writing works with no database configured, and lands in the change log.
await p.goto(H + "/labs/new", { waitUntil: "networkidle", timeout: 120000 });
await p.fill('input[name="code"]', "L-MERGED");
await p.fill('input[name="name"]', "مختبر الدمج");
await p.locator('form:has(input[name="code"]) button[type="submit"]').first().click();
await p.waitForURL(u => !u.pathname.endsWith("/new"), { timeout: 60000 }).catch(()=>{});
await p.goto(H + "/labs", { waitUntil: "networkidle", timeout: 120000 });
check("5a the record saved offline", (await p.locator("body").innerText()).includes("مختبر الدمج"));

// 6. Wrong password is rejected.
await p.goto(H + "/api/noop", { waitUntil: "domcontentloaded" }).catch(()=>{});
await ctx.clearCookies();
await p.goto(H + "/login", { waitUntil: "networkidle", timeout: 120000 });
await p.fill('input[name="email"]', "admin@spir.local");
await p.fill('input[name="password"]', "wrong");
await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await p.waitForTimeout(2500);
check("6a a wrong password is refused", new URL(p.url()).pathname === "/login", p.url());

check("7a no uncaught page errors", errs.length === 0, errs.slice(0,2).join(" | "));
console.log(`\n${r.filter(Boolean).length}/${r.length} checks passed`);
await b.close();
