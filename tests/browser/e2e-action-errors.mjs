// A button that fails must say why. Row buttons (submit, pay, cancel,
// remove…) used to be plain forms whose result nobody read: a refused action
// looked like a button that does nothing, and a business rule the database
// raised ("payment exceeds what is owed") ended on the error screen.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("action errors");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 1000 } });
ctx.setDefaultTimeout(60_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
const stamp = String(Date.now()).slice(-6);

// A message the button's own form shows (not Next's empty route announcer).
const alertText = async () =>
  (await p.locator('form [role="alert"]').allInnerTexts().catch(() => [])).join(" | ");
const errorScreen = async () => (await p.locator("body").innerText()).includes("حدث خطأ ما");

async function clickUntil(locator, done_, tries = 3) {
  // A click before the page has hydrated is lost: try again.
  for (let i = 0; i < tries && !(await done_()); i++) {
    await locator.click();
    await p.waitForTimeout(1500);
  }
}

// ---------------------------------------------------------------- 1. a refused add (unique name)
const stage = `مرحلة ${stamp}`;
await p.goto(H + "/masters", { waitUntil: "networkidle" });
const addForm = p.locator('form:has(input[name="table"][value="sales_stages"]):has(input[name="name"])');
await addForm.locator('input[name="name"]').fill(stage);
await addForm.locator("button").click();
await p.waitForLoadState("networkidle");
await p.locator("li", { hasText: stage }).first().waitFor({ timeout: 15_000 }).catch(() => {});
check("a new sales stage is added", (await p.locator("li", { hasText: stage }).count()) === 1);
const again = p.locator('form:has(input[name="table"][value="sales_stages"]):has(input[name="name"])');
await again.locator('input[name="name"]').fill(stage);
await clickUntil(again.locator("button"), async () => (await alertText()).length > 0);
check("adding the same name again says it is already used", (await alertText()).includes("مستخدم مسبقاً"), await alertText());
check("naming the field in Arabic, not by its column", !/[a-z]_[a-z]/.test(await alertText()), await alertText());

// ---------------------------------------------------------------- 2. a refused create (no error screen)
await p.goto(H + "/work-orders/new", { waitUntil: "networkidle" });
const product = p.locator('select[name="product_id"]');
const firstProduct = await product.locator("option").nth(1).getAttribute("value");
await product.selectOption(firstProduct ?? "");
await p.fill('input[name="wo_no"]', `WO-${stamp}`);
await p.fill('input[name="qty"]', "0");
await clickUntil(p.getByRole("button", { name: "إنشاء أمر عمل" }), async () => (await alertText()).length > 0 || (await errorScreen()));
check("a work order for zero units is refused with a reason", (await alertText()).includes("الكمية"), await alertText());
check("and not with the error screen", !(await errorScreen()));

// ---------------------------------------------------------------- 3. a business rule from the database
const invNo = `ERR-${stamp}`;
await p.goto(H + "/sales-invoices/new", { waitUntil: "networkidle" });
const lab = p.locator('select[name="lab_id"]');
await lab.selectOption({ index: 1 });
await p.fill('input[name="invoice_no"]', invNo);
const productSelect = p.locator('form select:has(option:has-text("(KIT-01)"))').first();
const kit = await productSelect.locator("option", { hasText: "(KIT-01)" }).first().getAttribute("value");
await productSelect.selectOption(kit ?? "");
await p.locator('input[name="items.0.rate"]').fill("10");
for (let i = 0; i < 3 && new URL(p.url()).pathname.endsWith("/new"); i++) {
  await p.getByRole("button", { name: /إنشاء فاتورة/ }).click();
  await p.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 20_000 }).catch(() => {});
}
await p.goto(H + `/sales-invoices?q=${invNo}`, { waitUntil: "networkidle" });
const row = () => p.locator("tr", { hasText: invNo }).first();
await clickUntil(row().getByRole("button", { name: "اعتماد" }), async () => (await row().locator('input[name="amount"]').count()) > 0);
check("the invoice is submitted", (await row().locator('input[name="amount"]').count()) === 1);
await row().locator('input[name="amount"]').fill("999999");
await clickUntil(row().getByRole("button", { name: "دفع" }), async () => (await alertText()).length > 0 || (await errorScreen()));
check("paying more than is owed says so, in Arabic", /[؀-ۿ]/.test(await alertText()) && (await alertText()).length > 5, await alertText());
check("still no error screen", !(await errorScreen()));

// ---------------------------------------------------------------- 4. a raised check_violation keeps its numbers
await p.goto(H + "/sales/new", { waitUntil: "networkidle" });
await p.locator('select[name="lab_id"]').selectOption({ index: 1 });
const saleProduct = p.locator('select[name="product_id"]');
const kitValue = await saleProduct.locator("option", { hasText: "KIT-01" }).first().getAttribute("value");
await saleProduct.selectOption(kitValue ?? "");
await p.fill('input[name="qty"]', "100000");
await clickUntil(p.getByRole("button", { name: "تسجيل بيع" }), async () => (await alertText()).length > 0 || (await errorScreen()));
check("selling more than is in stock says how much there is", (await alertText()).includes("الكمية غير كافية") && /\d/.test(await alertText()), await alertText());

check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
