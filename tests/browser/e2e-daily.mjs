// Everyday speed-ups, through the screens: search that forgives Arabic
// spelling, copying a document, recent customers first, the barcode scanner
// at the point of sale, which kit batch a sale takes, a list's search coming
// back, and sharing a document (WhatsApp, both currencies, Excel).
import { readFileSync } from "node:fs";
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("daily work");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 1000 }, acceptDownloads: true });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
const stamp = String(Date.now()).slice(-6);
const today = new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- 1. Arabic spelling
const labName = `مختبر أحمد الكندي ${stamp}`;
await p.goto(H + "/labs/new", { waitUntil: "networkidle" });
await p.fill('input[name="code"]', `AR-${stamp}`);
await p.fill('input[name="name"]', labName);
await p.locator('button[type="submit"]').last().click();
await p.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 60_000 }).catch(() => {});

await p.goto(H + "/labs", { waitUntil: "networkidle" });
await p.locator("[data-desk-shell] input").first().fill(`احمد الكندى ${stamp}`);
const visible = await p.locator("[data-desk-list] tbody tr:not([hidden])").allInnerTexts();
check("the list filter finds «أحمد الكندي» typed as «احمد الكندى»", visible.length === 1 && visible[0].includes(labName), visible.join(" | ").slice(0, 200));

await p.keyboard.press("Control+k");
const palette = p.locator("[cmdk-input]");
await palette.waitFor({ timeout: 10_000 }).catch(() => {});
await palette.fill(`احمد الكندى ${stamp}`);
await p.locator("[cmdk-item]", { hasText: labName }).first().waitFor({ timeout: 15_000 }).catch(() => {});
check("so does the search bar (Ctrl K)", (await p.locator("[cmdk-item]", { hasText: labName }).count()) > 0);
await p.keyboard.press("Escape");

// ---------------------------------------------------------------- 2. an invoice: recent customers, kit batches
await p.goto(H + "/sales-invoices/new", { waitUntil: "networkidle" });
await p.locator('select[name="lab_id"]').selectOption({ label: labName });
const productSelect = p.locator('form select:has(option:has-text("(KIT-01)"))').first();
const kitOption = await productSelect.locator("option", { hasText: "(KIT-01)" }).first().getAttribute("value");
await productSelect.selectOption(kitOption ?? "");
const lineHint = p.locator("[data-kit-hint]").first();
await lineHint.waitFor({ timeout: 15_000 }).catch(() => {});
check("an invoice line for a kit shows the batch it will take", (await lineHint.innerText().catch(() => "")).includes("DEMO-B-01"),
  await lineHint.innerText().catch(() => ""));
for (let attempt = 0; attempt < 3 && new URL(p.url()).pathname.endsWith("/new"); attempt++) {
  // A click before the form has hydrated is lost: try again.
  await p.getByRole("button", { name: /إنشاء فاتورة/ }).click();
  await p.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 20_000 }).catch(() => {});
}
check("the invoice is saved", !new URL(p.url()).pathname.endsWith("/new"),
  (await p.locator("main").innerText().catch(() => "")).slice(0, 300).replace(/\n/g, " | "));

await p.goto(H + "/sales-invoices/new", { waitUntil: "networkidle" });
await p.waitForTimeout(500);
const firstRecent = await p.locator('select[name="lab_id"] optgroup').first().locator("option").first().innerText().catch(() => "");
check("the customer used last is at the top of the list next time", firstRecent.includes(labName), firstRecent);
check("but nobody is chosen for you", (await p.locator('select[name="lab_id"]').inputValue()) === "");

// ---------------------------------------------------------------- 3. copying a document
await p.goto(H + "/sales-invoices", { waitUntil: "networkidle" });
const invHref = await p.locator('a[href^="/sales-invoices/"]').evaluateAll((as) =>
  as.map((a) => a.getAttribute("href")).find((h) => /^\/sales-invoices\/[0-9a-f-]{36}$/.test(h ?? "")) ?? null);
check("the invoice is in the list", !!invHref);
await p.goto(H + invHref, { waitUntil: "networkidle" });
const copyLink = p.locator("[data-copy-link]").first();
check("an invoice can be copied from its page", (await copyLink.count()) > 0);
await copyLink.click();
await p.waitForURL(/\/sales-invoices\/new\?from=/, { timeout: 30_000 }).catch(() => {});
await p.waitForLoadState("networkidle");
check("the copy starts with the same customer", (await p.locator('select[name="lab_id"] option:checked').innerText().catch(() => "")).includes(labName));
check("and the same lines", (await p.locator('form select:has(option:has-text("(KIT-01)"))').first().inputValue().catch(() => "")) === kitOption);
check("dated today, with no number yet", (await p.locator('input[name="posting_date"]').inputValue().catch(() => "")) === today &&
  (await p.locator('input[name="invoice_no"]').inputValue().catch(() => "x")) === "");

// ---------------------------------------------------------------- 4. barcode scanner at the point of sale
await p.goto(H + "/pos", { waitUntil: "networkidle" });
const scan = p.getByTestId("pos-search");
await scan.click();
await p.keyboard.type("KIT-01");
await p.keyboard.press("Enter");
await p.waitForTimeout(500);
check("a scanned code goes straight into the cart", (await p.locator("body").innerText()).includes("كِت كواشف تجريبي"));
check("and the search box is ready for the next scan", (await scan.inputValue()) === "");
const hint = p.locator("[data-kit-hint]").first();
await hint.waitFor({ timeout: 15_000 }).catch(() => {});
check("the cart says which kit batch goes out, and warns it expires soon",
  (await hint.getAttribute("data-kit-hint").catch(() => "")) === "soon" && (await hint.innerText().catch(() => "")).includes("DEMO-B-01"),
  await hint.innerText().catch(() => ""));

// ---------------------------------------------------------------- 5. a list's search comes back
await p.goto(H + "/sales-invoices?q=SI", { waitUntil: "networkidle" });
await p.goto(H + "/", { waitUntil: "networkidle" });
await p.goto(H + "/sales-invoices", { waitUntil: "networkidle" });
await p.waitForURL(/q=SI/, { timeout: 15_000 }).catch(() => {});
check("returning to a list brings its last search back", new URL(p.url()).searchParams.get("q") === "SI", p.url());
await p.getByRole("link", { name: "تفريغ" }).first().click();
await p.waitForURL((u) => !u.searchParams.get("q"), { timeout: 15_000 }).catch(() => {});
await p.goto(H + "/", { waitUntil: "networkidle" });
await p.goto(H + "/sales-invoices", { waitUntil: "networkidle" });
await p.waitForTimeout(1500);
check("«Clear» clears it for good", !new URL(p.url()).searchParams.get("q"), p.url());

// ---------------------------------------------------------------- 6. sharing a document
if (invHref) {
  await p.goto(H + invHref + "/print", { waitUntil: "networkidle" });
  const wa = (await p.locator("[data-whatsapp]").getAttribute("href").catch(() => "")) ?? "";
  check("a printed invoice has a WhatsApp button with the summary ready", wa.startsWith("https://wa.me/") && wa.includes("text="), wa);
  check("and the total in the other currency", (await p.locator("[data-other-currency]").count()) === 1);
}

await p.goto(H + "/labs", { waitUntil: "networkidle" });
const exportBtn = p.locator('[data-export="xlsx"]').first();
let download = null;
for (let attempt = 0; attempt < 3 && !download; attempt++) {
  // A click before hydration does nothing: try again.
  [download] = await Promise.all([p.waitForEvent("download", { timeout: 10_000 }).catch(() => null), exportBtn.click()]);
}
const saved = download ? await download.path() : null;
const head = saved ? readFileSync(saved).subarray(0, 2).toString("latin1") : "";
// The file is judged by its content: headless Chromium names a download
// with an Arabic name "download", where a real browser keeps the name.
check("a list exports to a real Excel file (a zip workbook)", !!download && head === "PK",
  download ? download.suggestedFilename() : "no download");

// ---------------------------------------------------------------- 7. the bell
await p.goto(H + "/", { waitUntil: "networkidle" });
await p.locator('header button[title="الإشعارات"]').first().click().catch(() => {});
await p.waitForTimeout(400);
const bell = await p.locator("body").innerText();
// Records were made here and nothing holds a copy yet: the administrator is told.
check("the bell says when the records exist on this computer only", bell.includes("سجلّات الشركة على هذا الحاسوب وحده"));

check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
