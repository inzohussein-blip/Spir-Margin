// Company identity, sales requests and transport authorisations — the three
// things the company puts its own name on.
import { H, SHOT, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("shortcuts");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1300, height: 1200 } });
const errs = [];
const p = await signIn(ctx);
p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));

const NAME = "شركة سبير للأجهزة الطبية";

// ── Branding ────────────────────────────────────────────────────────
await p.goto(H + "/settings", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForTimeout(1500);
check("settings offers company identity", (await p.locator("body").innerText()).includes("هوية الشركة"));

await p.fill('input[name="company_name"]', NAME);
await p.fill('input[name="tagline"]', "أجهزة ومستلزمات مختبرية");
await p.fill('input[name="phone"]', "0770-000-0000");
await p.fill('input[name="city"]', "بغداد");
await p.fill('input[name="doc_prefix"]', "SPR");
await p.fill('input[name="watermark_text"]', "نسخة");
await p.check('input[name="watermark_on"]');
// A 1x1 PNG is enough to prove the logo round-trips onto the page.
await p.setInputFiles('input[name="logo"]', {
  name: "logo.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
    "base64",
  ),
});
const brandingForm = p.locator('form:has(input[name="company_name"])');
await brandingForm.locator('button[type="submit"]').click();
// Wait for the confirmation itself rather than a guessed delay: saving
// uploads the logo, so how long it takes is not ours to predict.
const saved = p.locator('[role="status"]').filter({ hasText: "سيظهر على المستندات" });
await saved.waitFor({ state: "visible", timeout: 60000 }).catch(() => {});
check("branding saves", (await saved.count()) > 0);

// ── Shortcuts in the navigation ─────────────────────────────────────
await p.goto(H + "/", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.locator("aside").first().waitFor({ state: "visible", timeout: 60000 });
const nav = await p.locator("aside").first().innerText().catch(() => "");
check("a Shortcuts group is in the sidebar", nav.includes("اختصارات"), nav.split("\n").slice(0, 6).join(" / "));
// The sidebar lists workspaces; their items are on the workspace page.
// The sidebar lists workspaces and expands whichever one is active, so the
// items show once we are inside Shortcuts rather than on the dashboard.
await p.goto(H + "/sale-requests", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.locator("aside").first().waitFor({ state: "visible", timeout: 60000 });
const inside = await p.locator("aside").first().innerText();
check("it holds the sales request", inside.includes("طلبات البيع"));
check("and the transport authorisation", inside.includes("تخويلات النقل"));

// ── A sales request, end to end ─────────────────────────────────────
await p.goto(H + "/sale-requests/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.locator('input[name="customer_name"]').waitFor({ state: "visible", timeout: 60000 });
await p.fill('input[name="customer_name"]', "مستشفى الكندي");
await p.fill('input[name="customer_phone"]', "0771-111-1111");
await p.fill('input[name="items.0.description"]', "جهاز تحليل كيمياء");
await p.fill('input[name="items.0.qty"]', "2");
await p.fill('input[name="items.0.rate"]', "1500");
await p.click('button:has-text("إضافة سطر")');
await p.fill('input[name="items.1.description"]', "كواشف");
await p.fill('input[name="items.1.qty"]', "10");
await p.fill('input[name="items.1.rate"]', "25");
await p.fill('input[name="discount"]', "50");
const totalShown = await p.locator("dd").last().innerText();
check("the total is worked out live", totalShown.replace(/,/g, "") === "3200", totalShown);

await p.click('button:has-text("حفظ الطلب")');
await p.waitForURL((u) => /\/sale-requests\/[0-9a-f-]{36}/.test(u.pathname), { timeout: 60000 }).catch(() => {});
check("the request saves and opens", /\/sale-requests\/[0-9a-f-]{36}/.test(new URL(p.url()).pathname), p.url());

const detail = await p.locator("body").innerText();
check("its number carries the prefix", /SPR-REQ-\d{4}-\d{4}/.test(detail), detail.match(/SPR-REQ-[\d-]+/)?.[0] ?? "(none)");

// ── The receipt ─────────────────────────────────────────────────────
await p.click('a:has-text("طباعة الوصل")');
await p.waitForTimeout(3000);
const receipt = await p.locator("body").innerText();
check("the receipt carries the company name", receipt.includes(NAME));
check("and the date and number", /SPR-REQ-/.test(receipt));
check("and the customer", receipt.includes("مستشفى الكندي"));
check("a logo is printed", (await p.locator("img[alt='']").count()) > 0);
await p.emulateMedia({ media: "print" });
await p.screenshot({ path: `${SHOT}/receipt.png`, fullPage: true });
await p.emulateMedia({ media: "screen" });

// ── A transport authorisation ───────────────────────────────────────
await p.goto(H + "/authorizations/new", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.locator('input[name="bearer_name"]').waitFor({ state: "visible", timeout: 60000 });
await p.fill('input[name="bearer_name"]', "علي حسن");
await p.fill('input[name="bearer_id_no"]', "1990123456");
await p.fill('input[name="vehicle_plate"]', "12345 بغداد");
await p.selectOption('select[name="to_governorate"]', "أربيل");
await p.fill('input[name="destination"]', "مختبر أربيل المركزي");
await p.fill('input[name="purpose"]', "تركيب جهاز");
await p.fill('input[name="items.0.description"]', "محلّل كيمياء - موديل 200");
await p.fill('input[name="items.0.qty"]', "1");
await p.fill('input[name="items.0.serial_no"]', "SN-99881");
await p.click('button:has-text("إصدار التخويل")');
await p.waitForURL((u) => /\/authorizations\/[0-9a-f-]{36}/.test(u.pathname), { timeout: 60000 }).catch(() => {});
check("the authorisation is issued", /\/authorizations\/[0-9a-f-]{36}/.test(new URL(p.url()).pathname), p.url());

await p.click('a:has-text("طباعة التخويل")');
await p.waitForTimeout(3000);
const letter = await p.locator("body").innerText();
check("the letter has a subject line", letter.includes("م / تخويل نقل"));
check("it names the company", letter.includes(NAME));
check("it states the route", letter.includes("بغداد") && letter.includes("أربيل"));
check("it names the authorised person", letter.includes("علي حسن"));
check("it lists the equipment", letter.includes("محلّل كيمياء"));
check("it carries a reference", /SPR-TA-\d{4}-\d{4}/.test(letter), letter.match(/SPR-TA-[\d-]+/)?.[0] ?? "(none)");
check("it leaves room for a signature", letter.includes("التوقيع والختم"));
check("no Arabic-Indic digits anywhere", !/[٠-٩]/.test(letter));
await p.emulateMedia({ media: "print" });
await p.screenshot({ path: `${SHOT}/authorization.png`, fullPage: true });

check("no uncaught page errors", errs.length === 0, errs.slice(0, 2).join(" | "));
done();
await browser.close();
