// Remote access from other devices (Sync → Remote access, migration 0113).
//
// The main computer turns the gateway on, a second browser — standing in for
// a laptop elsewhere — meets the pairing page, is paired with a one-time
// code, signs in with an account of its own (the built-in one is refused
// from there), works, and is cut off. Everything through the screens.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("remote access");
const browser = await launch();
const opts = { locale: "ar-EG", viewport: { width: 1300, height: 1100 } };
const ctx = await browser.newContext(opts);
ctx.setDefaultTimeout(90_000);
const main = await signIn(ctx);
const errs = [];
main.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

const PORT = 3392;
const GW = `http://127.0.0.1:${PORT}`;
const stamp = String(Date.now()).slice(-6);
const email = `remote-${stamp}@example.com`;
const password = `remote-pass-${stamp}`;
const panel = () => main.locator("#remote");

async function openSync() {
  await main.goto(H + "/sync#remote", { waitUntil: "networkidle" });
}

// ---------------------------------------------------------------- 0. an account for the remote person
await main.goto(H + "/users", { waitUntil: "networkidle" });
const add = main.locator('form:has(input[name="full_name"])');
await add.locator('input[name="full_name"]').fill("موظف من بعيد");
await add.locator('input[name="email"]').fill(email);
await add.locator('input[name="password"]').fill(password);
await add.locator('button[type="submit"]').click();
await main.locator("tbody tr", { hasText: email }).waitFor({ timeout: 30_000 }).catch(() => {});

// ---------------------------------------------------------------- 1. off by default
await openSync();
check("the Sync page has a remote-access section", (await panel().count()) === 1);
check("off by default", (await panel().innerText()).includes("متوقّف"));
const closed = await fetch(GW + "/", { signal: AbortSignal.timeout(3000) }).then(() => "open").catch(() => "closed");
check("and nothing listens on its port", closed === "closed", closed);

// ---------------------------------------------------------------- 2. turn it on
await panel().locator('input[name="port"]').first().fill(String(PORT));
await panel().getByRole("button", { name: "شغّل الوصول من الأجهزة الأخرى" }).click();
await main.waitForURL(/done=remote-on/, { timeout: 30_000 }).catch(() => {});
await main.waitForLoadState("networkidle");
check("it turns on", (await panel().getByTestId("gateway-on").count()) === 1, (await panel().innerText()).slice(0, 200));
check("and lists the addresses to open", (await panel().getByTestId("gateway-urls").innerText().catch(() => "")).includes(`:${PORT}`));

// A stranger meets a locked door, not the sign-in page.
const stranger = await fetch(GW + "/login", { redirect: "manual", signal: AbortSignal.timeout(5000) });
check("an unpaired browser is sent to the pairing page", stranger.status === 303 && stranger.headers.get("location") === "/__spir/pair", `${stranger.status} ${stranger.headers.get("location")}`);
const post = await fetch(GW + "/login", { method: "POST", body: "x", redirect: "manual", signal: AbortSignal.timeout(5000) });
check("and cannot post anything", post.status === 401, String(post.status));

// ---------------------------------------------------------------- 3. pair a device
await panel().locator('input[name="name"]').fill(`حاسوب محمول ${stamp}`);
await panel().getByRole("button", { name: "أضف جهازاً" }).click();
const codeEl = panel().locator("[data-pair-code]");
await codeEl.waitFor({ timeout: 20_000 }).catch(() => {});
const pairCode = (await codeEl.innerText().catch(() => "")).trim();
check("adding a device shows a one-time code", /^\d{4}-\d{4}$/.test(pairCode), pairCode);

const far = await browser.newContext(opts);
far.setDefaultTimeout(90_000);
const p = await far.newPage();
p.on("pageerror", (e) => errs.push(`far: ${String(e).slice(0, 140)}`));
await p.goto(GW + "/", { waitUntil: "domcontentloaded" });
check("the other device sees the pairing page", (await p.locator("h1").innerText()).includes("اربط هذا الجهاز"));

await p.fill('input[name="code"]', "0000-0000");
await p.getByRole("button", { name: "اربط" }).click();
await p.waitForLoadState("domcontentloaded");
check("a wrong code is refused", (await p.locator('[role="alert"]').innerText().catch(() => "")).includes("غير صحيح"));

await p.fill('input[name="code"]', pairCode);
await p.getByRole("button", { name: "اربط" }).click();
await p.waitForURL((u) => !u.pathname.startsWith("/__spir"), { timeout: 60_000 }).catch(() => {});
check("the right code lets it through to the sign-in page", new URL(p.url()).pathname === "/login", p.url());
const loginText = await p.locator("main").innerText().catch(() => "");
check("which does not offer the built-in account", !loginText.includes("admin@spir.local") && loginText.includes("من جهاز آخر"));

// The code worked once.
const again = await fetch(GW + "/__spir/pair", {
  method: "POST", body: `code=${pairCode}`, headers: { "content-type": "application/x-www-form-urlencoded" },
  redirect: "manual", signal: AbortSignal.timeout(5000),
});
check("the same code does not work a second time", again.status === 403, String(again.status));

// ---------------------------------------------------------------- 4. accounts from there
await p.fill('input[name="email"]', "admin@spir.local");
await p.fill('input[name="password"]', "123");
await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await p.locator('[role="alert"]').filter({ hasText: /الحساب الثابت/ }).first().waitFor({ timeout: 30_000 }).catch(() => {});
check("the built-in account is refused from another device", new URL(p.url()).pathname === "/login" &&
  (await p.locator("main").innerText()).includes("الحساب الثابت يعمل على الحاسوب الرئيسي نفسه فقط"));

await p.fill('input[name="email"]', email);
await p.fill('input[name="password"]', password);
await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }).catch(() => {});
check("the person's own account signs in", !new URL(p.url()).pathname.startsWith("/login"), p.url());

// Work done there lands on the main computer.
await p.goto(GW + "/labs/new", { waitUntil: "networkidle" });
await p.fill('input[name="code"]', `RMT-${stamp}`);
await p.fill('input[name="name"]', `مختبر من بعيد ${stamp}`);
await p.locator('button[type="submit"]').last().click();
await p.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 60_000 }).catch(() => {});
await main.goto(H + "/labs", { waitUntil: "networkidle" });
check("a record made from the other device is on the main computer", (await main.locator("main").innerText()).includes(`مختبر من بعيد ${stamp}`));

// ---------------------------------------------------------------- 5. the device list, and cutting off
await openSync();
const row = panel().locator(`tr[data-device="حاسوب محمول ${stamp}"]`);
check("the device is listed as allowed, with when it was last seen", (await row.innerText().catch(() => "")).includes("مسموح"), await row.innerText().catch(() => ""));

main.once("dialog", (d) => d.accept());
await row.getByRole("button", { name: "اقطع" }).click();
await main.waitForURL(/done=device-off/, { timeout: 30_000 }).catch(() => {});
await p.goto(GW + "/labs", { waitUntil: "domcontentloaded" });
check("once cut off, the device is back at the pairing page", new URL(p.url()).pathname === "/__spir/pair", p.url());

// ---------------------------------------------------------------- 6. switch off
await openSync();
await panel().getByRole("button", { name: "أوقف الوصول من الأجهزة الأخرى" }).click();
await main.waitForURL(/done=remote-off/, { timeout: 30_000 }).catch(() => {});
await main.waitForTimeout(1000);
const after = await fetch(GW + "/", { signal: AbortSignal.timeout(3000) }).then(() => "open").catch(() => "closed");
check("switching it off closes the port", after === "closed", after);

check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
