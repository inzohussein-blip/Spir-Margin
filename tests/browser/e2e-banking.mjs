// The reconciliation workbench end to end: create an account, a payment and a
// bank line, match them, then confirm the action log shows the match — read
// from the database, not from this browser's storage.
import { H, SHOT, ACCOUNT, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("banking");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 1200 } });
// This suite types its own data in, and the first page after a fresh build
// also boots the database and runs every migration, which outruns the 30s
// default on a loaded machine.
ctx.setDefaultTimeout(90_000);
const errs = [];
const p = await signIn(ctx);
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
check("signed in", !new URL(p.url()).pathname.startsWith("/login"), p.url());

// The shell carries a search form of its own, so a submit is always scoped to
// the form that holds the field just filled. A created record redirects away
// from the /new page, so waiting for that is what "it saved" actually means —
// a fixed pause is a guess, and the guess is what made this suite flaky.
const submit = async (field) => {
  await p.locator(`form:has(input[name="${field}"]) button[type="submit"]`).first().click();
  await p
    .waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 90_000 })
    .catch(() => {});
  await p.waitForLoadState("networkidle").catch(() => {});
  if (!p.url().endsWith("/new")) return true;
  // Still on the form: say why, so a failure names the reason instead of the URL.
  const body = (await p.locator("body").innerText()).replace(/\n+/g, " | ");
  lastFormError = body.slice(body.indexOf("إنشاء") >= 0 ? body.indexOf("إنشاء") : 0).slice(0, 300);
  return false;
};
let lastFormError = "";

/** Wait for text to appear on the page rather than sleeping and hoping. */
const seeText = (needle, timeout = 30_000) =>
  p
    .locator(`text=${needle}`)
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);

// 1. a bank account
await p.goto(H + "/banking/accounts/new", { waitUntil: "domcontentloaded", timeout: 120000 });
const formUp = await p
  .locator('input[name="account_name"]')
  .waitFor({ state: "visible", timeout: 60_000 })
  .then(() => true)
  .catch(() => false);
check("the new-account form renders", formUp,
  formUp ? "" : (await p.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 300));
if (!formUp) { await browser.close(); done(); process.exit(1); }
await p.fill('input[name="account_name"]', "حساب التسوية");
await p.fill('input[name="bank"]', "مصرف الرافدين");
check("the bank account saved", await submit("account_name"), p.url());

// 2. an open payment
await p.goto(H + "/banking/payments/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.selectOption('select[name="payment_type"]', "receive").catch(() => {});
await p.fill('input[name="party_name"]', "مختبر النور");
await p.fill('input[name="amount"]', "1500");
check("the payment saved", await submit("amount"), lastFormError || p.url());

// 3. a bank line for the same amount. The seed already ships bank accounts,
// so the account is found by NAME — "the first link on the page" is not the
// one the workbench has selected, and matching them by luck is how this suite
// used to pass.
await p.goto(H + "/banking", { waitUntil: "domcontentloaded", timeout: 120000 });
const acct = await p
  .locator('a[href^="/banking/"]')
  .filter({ hasText: "حساب التسوية" })
  .first()
  .getAttribute("href");
check("the new bank account is listed", !!acct, acct ?? "(none)");
const acctId = (acct ?? "").split("/").pop();
await p.goto(H + acct + "/transactions/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.fill('input[name="deposit"]', "1500");
await p.fill('input[name="description"]', "إيداع مختبر النور");
check("the bank line saved", await submit("deposit"), lastFormError || p.url());

// 4. match them in the workbench
await p.goto(H + "/banking/reconcile", { waitUntil: "domcontentloaded", timeout: 120000 });
const pickAccount = async () => {
  await p.locator("select").first().selectOption(acctId).catch(() => {});
  await p.waitForTimeout(1200);
};
await pickAccount();
check("the unreconciled line reaches the workbench", await seeText("إيداع مختبر النور", 60_000));
let text = await p.locator("body").innerText();
check("the workbench is Arabic", text.includes("تسوية بنكية") && text.includes("مطابقة وتسوية"));
check("no untranslated English sentence", !/Select a bank line/i.test(text));
check("no Arabic-Indic digits", !/[٠-٩]/.test(text));
check("the unreconciled line is shown", text.includes("إيداع مختبر النور"));

await p.getByRole("button", { name: /إيداع مختبر النور/ }).first().click();
await p.waitForTimeout(500);
await p.getByRole("button", { name: /^مطابقة$/ }).first().click();
await p.waitForTimeout(2500);

// 5. the log must carry the match, with who did it
await p.getByRole("tab", { name: /سجل الإجراءات/ }).first().click().catch(async () => {
  await p.getByText("سجل الإجراءات").first().click();
});
await p.waitForTimeout(1200);
text = await p.locator("body").innerText();
check("the action log records the match", text.includes("مطابقة") && text.includes("مختبر النور"));
check("it records who did it", text.includes(ACCOUNT.email));
check("the log is not empty", !text.includes("لا إجراءات بعد"));

// 6. and it survives a different browser session — it lives in the database
const ctx2 = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 1200 } });
ctx2.setDefaultTimeout(90_000);
const p2 = await signIn(ctx2);
await p2.goto(H + "/banking/reconcile", { waitUntil: "domcontentloaded", timeout: 120000 });
await p2.locator("select").first().selectOption(acctId).catch(() => {});
await p2.waitForTimeout(1500);
await p2.getByRole("tab", { name: /سجل الإجراءات/ }).first().click().catch(() => {});
await p2.waitForTimeout(1200);
const text2 = await p2.locator("body").innerText();
check("a fresh browser sees the same log", text2.includes("مختبر النور") && !text2.includes("لا إجراءات بعد"));

// 7. partial allocation: a payment smaller than the bank line
await p.goto(H + "/banking/payments/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.selectOption('select[name="payment_type"]', "receive").catch(() => {});
await p.fill('input[name="party_name"]', "مختبر الرشيد");
await p.fill('input[name="amount"]', "1000");
check("the partial payment saved", await submit("amount"), p.url());

await p.goto(H + acct + "/transactions/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.fill('input[name="deposit"]', "1500");
await p.fill('input[name="description"]', "إيداع كبير");
check("the larger bank line saved", await submit("deposit"), p.url());

await p.goto(H + "/banking/reconcile", { waitUntil: "domcontentloaded", timeout: 120000 });
await pickAccount();
await p.getByRole("button", { name: /إيداع كبير/ }).first().click();
await p.waitForTimeout(800);
text = await p.locator("body").innerText();
check("a payment that covers only part of the line is offered", text.includes("مطابقة جزئية"));
check("and the amount it would take is editable",
  (await p.locator('input[aria-label="المبلغ المراد تخصيصه"]').count()) > 0);

await p.getByRole("button", { name: /^مطابقة$/ }).first().click();
await p.waitForTimeout(2500);
text = await p.locator("body").innerText();
check("the line stays open for the remainder", text.includes("إيداع كبير") && text.includes("مُخصَّص جزئياً"));
check("and shows what is left", text.includes("المتبقّي"));

// 8. a wrong-direction payment is offered but not clickable
await p.goto(H + "/banking/payments/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.selectOption('select[name="payment_type"]', "pay").catch(() => {});
await p.fill('input[name="party_name"]', "مورد");
await p.fill('input[name="amount"]', "500");
check("the outgoing payment saved", await submit("amount"), p.url());
await p.goto(H + "/banking/reconcile", { waitUntil: "domcontentloaded", timeout: 120000 });
await pickAccount();
await p.getByRole("button", { name: /إيداع كبير/ }).first().click();
await p.waitForTimeout(800);
text = await p.locator("body").innerText();
check("a payment in the wrong direction is marked as no match", text.includes("لا تطابق"));

// 9. several lines at once
await p.locator('input[type="checkbox"]').first().check();
await p.waitForTimeout(500);
text = await p.locator("body").innerText();
check("ticking a line opens the bulk bar", text.includes("السطور المحدّدة:"));
check("it offers matching the selection by rules", text.includes("مطابقة المحدّد بالقواعد"));
check("it offers a payment for each", text.includes("إنشاء دفعة لكلٍّ منها"));

// 10. older lines outside the chosen window are announced, not hidden
const from = new Date();
from.setDate(from.getDate() + 1); // a window that starts tomorrow: everything is older
await p.locator('input[type="date"]').first().fill(from.toISOString().slice(0, 10));
await p.waitForTimeout(2000);
text = await p.locator("body").innerText();
check("older unreconciled lines are announced", text.includes("سطور أقدم غير مُسوّاة خارج هذه المدّة"));
await p.getByText("اعرضها").first().click();
await p.waitForTimeout(2000);
text = await p.locator("body").innerText();
check("and can be brought back into view", text.includes("إيداع كبير"));
check("still no Arabic-Indic digits", !/[٠-٩]/.test(text));

// 11. a match can be undone, and the line comes back
await p.getByRole("tab", { name: /^المطابقات$/ }).first().click().catch(async () => {
  await p.getByText("المطابقات").first().click();
});
await p.waitForTimeout(1200);
text = await p.locator("body").innerText();
check("matched lines are listed", !text.includes("لا مطابقات في هذه المدّة"));
check("each one offers an undo", (await p.getByRole("button", { name: /إلغاء المطابقة/ }).count()) > 0);

const before = await p.getByRole("button", { name: /إلغاء المطابقة/ }).count();
await p.getByRole("button", { name: /إلغاء المطابقة/ }).first().click();
await p.waitForTimeout(2500);
const afterCount = await p.getByRole("button", { name: /إلغاء المطابقة/ }).count();
const activeTab = await p.locator('[role="tab"][data-state="active"]').innerText().catch(() => "(none)");
check("undoing removes it from the matched list", afterCount === before - 1,
  `${before} -> ${afterCount} · tab=${activeTab}`);

await p.getByRole("tab", { name: /سجل الإجراءات/ }).first().click().catch(() => {});
await p.waitForTimeout(1200);
text = await p.locator("body").innerText();
check("the undo is recorded in the action log", text.includes("إلغاء مطابقة"));

check("no uncaught page errors", errs.length === 0, errs.join(" | "));
if (process.exitCode) await p.screenshot({ path: SHOT("banking"), fullPage: true });
await browser.close();
done();
