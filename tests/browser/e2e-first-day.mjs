// The first day on an empty database.
//
// A real installation starts with no demo records (SPIR_SEED=none): the
// company's own labs and products go in, and the first sale goes out. This
// walks exactly that, and is meant to run against an EMPTY database:
//
//   SPIR_SEED=none npm run test:browser -- first-day
//
// Against a seeded database it still passes — it only ever adds its own records.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("first day");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG" });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

const submit = async (field) => {
  await p.locator(`form:has([name="${field}"]) button[type="submit"]`).first().click();
  await p.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 90_000 }).catch(() => {});
  await p.waitForLoadState("networkidle").catch(() => {});
  return !p.url().endsWith("/new");
};

if (process.env.SPIR_SEED === "none") {
  await p.goto(H + "/labs", { waitUntil: "networkidle" });
  const t = await p.locator("body").innerText();
  // The demo labs are the only ones whose names end in "التجريبي".
  check("an empty install really starts with no demo labs", !t.includes("التجريبي"));
}

// 1. The company's first customer.
await p.goto(H + "/labs/new", { waitUntil: "networkidle" });
await p.fill('input[name="code"]', "LAB-FIRST");
await p.fill('input[name="name"]', "مختبر اليوم الأول");
check("the first lab is saved", await submit("code"), p.url());

// 2. Its first product, with prices.
await p.goto(H + "/products/new", { waitUntil: "networkidle" });
await p.fill('input[name="item_code"]', "KIT-FIRST");
await p.fill('input[name="name"]', "كِت اليوم الأول");
await p.selectOption('select[name="product_type"]', "kit");
await p.fill('input[name="default_buy_price"]', "60");
await p.fill('input[name="default_sell_price"]', "100");
check("the first product is saved", await submit("item_code"), p.url());

// 3. Stock comes in before anything goes out: kits are sold from batches, and
//    an empty install has none. (Refusing to sell what is not there is right.)
await p.goto(H + "/kits/new", { waitUntil: "networkidle" });
await p.fill('input[name="batch_no"]', "B-FIRST");
const kitValue = await p.locator('select[name="product_id"] option', { hasText: "كِت اليوم الأول" }).first().getAttribute("value");
await p.selectOption('select[name="product_id"]', kitValue);
await p.fill('input[name="qty_received"]', "10");
check("the first stock is received", await submit("batch_no"), p.url());

// 4. The first sale, at the point of sale.
await p.goto(H + "/pos", { waitUntil: "networkidle" });
const labValue = await p.locator("select option", { hasText: "مختبر اليوم الأول" }).first().getAttribute("value");
await p.locator("select").first().selectOption(labValue);
await p.getByRole("button", { name: /كِت اليوم الأول/ }).first().click();
await p.getByRole("button", { name: "إتمام البيع" }).click();
const sold = await p.getByText("تم تسجيل البيع").waitFor({ timeout: 30_000 }).then(() => true, () => false);
check("the first sale is recorded", sold,
  sold ? "" : (await p.locator("aside").last().innerText()).replace(/\s+/g, " ").slice(0, 200));

// A cashier asking for more than is in stock is told so — in Arabic, with the numbers.
await p.getByRole("button", { name: /كِت اليوم الأول/ }).first().click();
for (let i = 0; i < 12; i++) await p.getByRole("button", { name: /كِت اليوم الأول/ }).first().click();
await p.getByRole("button", { name: "إتمام البيع" }).click();
const refusal = await p.getByText(/الكمية غير كافية من كِت اليوم الأول: المتوفّر 9/).waitFor({ timeout: 30_000 }).then(() => true, () => false);
check("overselling is refused in Arabic, with what is left", refusal,
  refusal ? "" : (await p.locator("aside").last().innerText()).replace(/\s+/g, " ").slice(0, 200));

// 5. And it shows where the company will look for it.
await p.goto(H + "/", { waitUntil: "networkidle" });
const home = await p.locator("body").innerText();
check("the dashboard renders after the first sale", !home.includes("حدث خطأ ما"));

check("no uncaught page errors", errs.length === 0, errs.join(" | "));
await browser.close();
done();
