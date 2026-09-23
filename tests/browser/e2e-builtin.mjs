// The built-in account's password: changed from Settings, hidden from the
// sign-in page once changed, and put back with the reset file. Every other
// suite signs in with 123, so this one always puts it back.
import { writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { H, launch, results } from "./harness.mjs";

const { check, done } = results("built-in password");
const browser = await launch();
const opts = { locale: "ar-EG", viewport: { width: 1300, height: 1000 } };
const RESET = join(process.cwd(), "RESET-ADMIN-PASSWORD.txt");
const NEW = "Spir-Company-2026";

async function tryLogin(password) {
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  await p.goto(H + "/login", { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "admin@spir.local");
  await p.fill('input[name="password"]', password);
  await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 }).catch(() => {});
  return { ctx, p, in: !new URL(p.url()).pathname.startsWith("/login") };
}

try {
  const first = await tryLogin("123");
  check("123 works before it is changed", first.in);
  const other = await tryLogin("123"); // a second browser, to be signed out

  await first.p.goto(H + "/settings", { waitUntil: "networkidle" });
  const panel = first.p.locator("#builtin");
  check("Settings has the built-in password panel", (await panel.count()) === 1);
  check("it says the password is still 123", (await panel.innerText()).includes("123"));

  await panel.locator('input[name="current"]').fill("123");
  await panel.locator('input[name="next"]').fill("123");
  await panel.locator('input[name="again"]').fill("123");
  await panel.getByRole("button", { name: "غيّر كلمة المرور" }).click();
  await first.p.waitForTimeout(1500);
  check("123 itself is refused as the new password", (await panel.locator('[role="alert"]').innerText().catch(() => "")).length > 0);

  await panel.locator('input[name="current"]').fill("123");
  await panel.locator('input[name="next"]').fill(NEW);
  await panel.locator('input[name="again"]').fill(NEW);
  await panel.getByRole("button", { name: "غيّر كلمة المرور" }).click();
  await first.p.waitForURL(/builtin=changed/, { timeout: 30_000 }).catch(() => {});
  check("the change is confirmed", (await first.p.locator('[role="status"]').first().innerText().catch(() => "")).includes("تغيّرت"));

  await first.p.goto(H + "/labs", { waitUntil: "networkidle" });
  check("the browser that changed it stays signed in", new URL(first.p.url()).pathname === "/labs");
  await other.p.goto(H + "/labs", { waitUntil: "networkidle" });
  check("the other browser is signed out", new URL(other.p.url()).pathname.startsWith("/login"));

  const login = await (await browser.newContext(opts)).newPage();
  await login.goto(H + "/login", { waitUntil: "networkidle" });
  const card = await login.locator("main").innerText();
  check("the sign-in page no longer shows 123", !/(^|\s)123(\s|$)/.test(card) && card.includes("يضبطها المسؤول"));

  check("123 no longer works", !(await tryLogin("123")).in);
  check("the new password works", (await tryLogin(NEW)).in);
} finally {
  // Put 123 back the way a person who forgot would: the reset file.
  writeFileSync(RESET, "");
  const back = await tryLogin("123");
  check("the reset file puts 123 back", back.in);
  check("and is removed once used", !existsSync(RESET));
  if (existsSync(RESET)) rmSync(RESET);
  await browser.close();
}
done();
