// Accounts: adding a user, resetting a forgotten password, and what that does
// to the sessions already open.
//
// A reset that leaves the old session working is no reset — someone who has
// the old password, or a browser left signed in, keeps going for a week. So
// every step here is checked from the other person's browser, not the admin's.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("accounts");
const browser = await launch();
const opts = { locale: "ar-EG", viewport: { width: 1400, height: 1000 } };
const errs = [];

const admin = await browser.newContext(opts);
admin.setDefaultTimeout(90_000);
const a = await signIn(admin);
a.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

const email = `reset-${Date.now()}@spir.test`;
const first = "first-pass-1";
const second = "second-pass-2";
const third = "third-pass-3";

/** A fresh browser signed in as `email`, or the page left on /login if refused. */
async function signInAs(password) {
  const ctx = await browser.newContext(opts);
  ctx.setDefaultTimeout(90_000);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  await p.goto(H + "/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', password);
  await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 }).catch(() => {});
  await p.waitForLoadState("networkidle").catch(() => {});
  return { ctx, p, in: !new URL(p.url()).pathname.startsWith("/login") };
}

/** Whether a browser is still let in: open a page and see where it lands. */
async function stillIn(p) {
  await p.goto(H + "/labs", { waitUntil: "networkidle" });
  return new URL(p.url()).pathname === "/labs";
}

const row = () => a.locator("tbody tr", { hasText: email });

// 1. Adding a user says so in Arabic, and a second one with the same email is refused.
await a.goto(H + "/users", { waitUntil: "networkidle" });
const add = a.locator('form:has(input[name="full_name"])');
await add.locator('input[name="full_name"]').fill("موظف الاختبار");
await add.locator('input[name="email"]').fill(email);
await add.locator('input[name="password"]').fill(first);
await add.locator('button[type="submit"]').click();
await row().waitFor();
check("a new user appears in the list", (await row().count()) === 1);

await a.goto(H + "/users", { waitUntil: "networkidle" });
await add.locator('input[name="email"]').fill(email);
await add.locator('input[name="password"]').fill("another-pass");
await add.locator('button[type="submit"]').click();
const dup = add.locator("p.text-red-700");
await dup.waitFor({ timeout: 20_000 }).catch(() => {});
const dupText = (await dup.innerText().catch(() => "")).trim();
check("the same email twice is refused — no false «created»", dupText.includes("يوجد مستخدم"), dupText);
check("in Arabic", /[؀-ۿ]/.test(dupText) && !/[A-Za-z]{3}/.test(dupText), dupText);

// 2. The user signs in, twice — two devices.
const one = await signInAs(first);
const two = await signInAs(first);
check("the user can sign in", one.in && two.in);

// Kept to replay later, the way a stolen cookie would be.
const oldCookies = await two.ctx.cookies();

// 3. The admin resets the password from the list.
await a.goto(H + "/users", { waitUntil: "networkidle" });
const reset = row().getByRole("button", { name: "إعادة تعيين كلمة المرور" });
check("each user has a «إعادة تعيين كلمة المرور» button", (await reset.count()) === 1);
await reset.click();
await row().locator('input[name="password"]').fill("short");
await row().getByRole("button", { name: "حفظ" }).click();
const tooShort = row().locator('[role="alert"]');
// The browser's own minlength check may stop it first; either way it must not save.
await tooShort.waitFor({ timeout: 5_000 }).catch(() => {});
check("a short password is not accepted", (await row().locator('[role="status"]').count()) === 0);

await row().locator('input[name="password"]').fill(second);
await row().getByRole("button", { name: "حفظ" }).click();
const ok = row().locator('[role="status"]');
await ok.waitFor({ timeout: 20_000 }).catch(() => {});
const okText = (await ok.innerText().catch(() => "")).trim();
check("the reset is confirmed in Arabic", okText.includes("تمّ تعيين كلمة المرور"), okText);

// 4. Both open sessions end, and say why.
check("the first device is signed out", !(await stillIn(one.p)), one.p.url());
check("with the reason on the sign-in page",
  (await one.p.locator('[role="status"]').innerText().catch(() => "")).includes("انتهت جلستك"));
check("and it returns to the page it was on", new URL(one.p.url()).searchParams.get("next") === "/labs", one.p.url());
const cookies = (await one.ctx.cookies()).map((c) => c.name);
check("the ended cookie is removed", !cookies.includes("spir_session"), cookies.join(","));
check("the second device is signed out too", !(await stillIn(two.p)));

// A copy of the old cookie is no good either: the page is not served.
const replay = await browser.newContext(opts);
await replay.addCookies(oldCookies);
const res = await replay.request.get(H + "/labs", { maxRedirects: 0 });
check("a copied old cookie gets no page", res.status() !== 200 && (res.headers()["location"] ?? "").includes("/login/expired"),
  `${res.status()} → ${res.headers()["location"] ?? ""}`);
await replay.close();

// 5. Old password out, new password in.
check("the old password no longer works", !(await signInAs(first)).in);
const fresh = await signInAs(second);
check("the new one does", fresh.in);

// 6. Changing one's own password keeps this browser and ends the others.
const other = await signInAs(second);
await fresh.p.goto(H + "/account", { waitUntil: "networkidle" });
await fresh.p.fill('input[name="current_password"]', second);
await fresh.p.fill('input[name="new_password"]', third);
await fresh.p.locator('form:has(input[name="new_password"]) button[type="submit"]').click();
await fresh.p.waitForURL(/changed=1/, { timeout: 20_000 }).catch(() => {});
const changed = fresh.p.locator('main [role="status"]');
await changed.waitFor({ timeout: 20_000 }).catch(() => {});
check("changing one's own password is confirmed in Arabic",
  (await changed.innerText().catch(() => "")).includes("تمّ تغيير كلمة المرور"));
check("this browser stays signed in", await stillIn(fresh.p));
check("the other device is signed out", !(await stillIn(other.p)));

// 7. Disabling ends the session too.
await a.goto(H + "/users", { waitUntil: "networkidle" });
await row().getByRole("button", { name: "إيقاف" }).click();
await a.waitForLoadState("networkidle");
check("a disabled user is signed out at the next click", !(await stillIn(fresh.p)));
check("and cannot sign back in", !(await signInAs(third)).in);

// 8. The built-in admin is never caught by any of this.
check("the admin's own session is untouched", await stillIn(a));

// Tidy: leave the account disabled, which is what the list is for.
check("no uncaught page errors", errs.length === 0, errs.join(" | "));
await browser.close();
done();
