// The reconciliation workbench end to end: create an account, a payment and a
// bank line, match them, then confirm the action log shows the match — read
// from the database, not from this browser's storage.
import { H, SHOT, ACCOUNT, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("banking");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 1200 } });
const errs = [];
const p = await signIn(ctx);
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

// The shell carries a search form of its own, so a submit is always scoped to
// the form that holds the field just filled.
const submit = async (field) => {
  await p.locator(`form:has(input[name="${field}"]) button[type="submit"]`).first().click();
  await p.waitForLoadState("networkidle").catch(() => {});
  await p.waitForTimeout(1000);
};

// 1. a bank account
await p.goto(H + "/banking/accounts/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.fill('input[name="account_name"]', "حساب التسوية");
await p.fill('input[name="bank"]', "مصرف الرافدين");
await submit("account_name");

// 2. an open payment
await p.goto(H + "/banking/payments/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.selectOption('select[name="payment_type"]', "receive").catch(() => {});
await p.fill('input[name="party_name"]', "مختبر النور");
await p.fill('input[name="amount"]', "1500");
await submit("amount");

// 3. a bank line for the same amount
await p.goto(H + "/banking", { waitUntil: "domcontentloaded", timeout: 120000 });
const acct = await p.locator('a[href^="/banking/"]:not([href$="/new"]):not([href$="/import"]):not([href$="/rules"]):not([href$="/payments"]):not([href$="/reconcile"]):not([href$="/transfer"])').first().getAttribute("href");
check("the new bank account is listed", !!acct, acct ?? "(none)");
await p.goto(H + acct + "/transactions/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.fill('input[name="deposit"]', "1500");
await p.fill('input[name="description"]', "إيداع مختبر النور");
await submit("deposit");

// 4. match them in the workbench
await p.goto(H + "/banking/reconcile", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForTimeout(1500);
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
const p2 = await signIn(ctx2);
await p2.goto(H + "/banking/reconcile", { waitUntil: "domcontentloaded", timeout: 120000 });
await p2.waitForTimeout(1500);
await p2.getByRole("tab", { name: /سجل الإجراءات/ }).first().click().catch(() => {});
await p2.waitForTimeout(1200);
const text2 = await p2.locator("body").innerText();
check("a fresh browser sees the same log", text2.includes("مختبر النور") && !text2.includes("لا إجراءات بعد"));

check("no uncaught page errors", errs.length === 0, errs.join(" | "));
if (process.exitCode) await p.screenshot({ path: SHOT("banking"), fullPage: true });
await browser.close();
done();
