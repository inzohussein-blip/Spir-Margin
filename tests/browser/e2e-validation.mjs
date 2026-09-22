import { H, SHOT, launch, signIn } from "./harness.mjs";
const r = [];
const check = (n, ok, d = "") => { r.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const b = await launch();
const p = await (await b.newContext({ locale: "ar-EG", viewport: { width: 1300, height: 1000 } })).newPage();
const errs = []; p.on("pageerror", e => errs.push(String(e).slice(0,120)));

await p.goto(H + "/login", { waitUntil: "networkidle", timeout: 300000 });
await p.fill('input[name="email"]', "admin@spir.local");
await p.fill('input[name="password"]', "123");
await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await p.waitForURL(u => !u.pathname.startsWith("/login"), { timeout: 180000 }).catch(()=>{});

// First save of a fresh code must still work.
await p.goto(H + "/labs/new", { waitUntil: "networkidle", timeout: 120000 });
await p.fill('input[name="code"]', "LAB-DUP");
await p.fill('input[name="name"]', "مختبر أول");
await p.locator('button[type="submit"]').last().click();
await p.waitForURL(u => !u.pathname.endsWith("/new"), { timeout: 60000 }).catch(()=>{});
check("a valid save still redirects", !p.url().endsWith("/new"), p.url());

// Now the same code again — this used to crash into "حدث خطأ ما".
await p.goto(H + "/labs/new", { waitUntil: "networkidle", timeout: 120000 });
await p.fill('input[name="code"]', "LAB-DUP");
await p.fill('input[name="name"]', "مختبر ثانٍ");
await p.fill('input[name="city"]', "الموصل");
await p.locator('button[type="submit"]').last().click();
await p.waitForTimeout(6000);

const body = await p.locator("body").innerText();
check("no crash screen", !body.includes("حدث خطأ ما"), body.includes("حدث خطأ ما") ? "error boundary shown" : "");
check("stays on the form", p.url().includes("/labs/new"), p.url());
const alert = await p.locator('[role="alert"]').first().innerText().catch(()=>"(none)");
check("shows an inline message", alert.includes("مستخدم مسبقاً"), alert);
check("names the field and value", alert.includes("LAB-DUP"), alert);
check("typed values are preserved", (await p.inputValue('input[name="name"]')) === "مختبر ثانٍ"
  && (await p.inputValue('input[name="city"]')) === "الموصل");
check("no uncaught page errors", errs.length === 0, errs.slice(0,2).join(" | "));
await p.screenshot({ path: `${SHOT}/validation.png` });

// Correcting the code and resubmitting should now succeed.
await p.fill('input[name="code"]', "LAB-DUP2");
await p.locator('button[type="submit"]').last().click();
await p.waitForURL(u => !u.pathname.endsWith("/new"), { timeout: 60000 }).catch(()=>{});
check("fixing the value lets it save", !p.url().endsWith("/new"), p.url());

console.log(`\n${r.filter(Boolean).length}/${r.length} checks passed`);
await b.close();
