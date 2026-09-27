// Cold chain & calibration (migration 0118): a fridge with its range, the
// day's readings with an alarm and its action, the printable month sheet,
// and an instrument with a routine task and a calibration.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("cold chain");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1440, height: 1000 } });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
const settle = () => p.waitForLoadState("networkidle").catch(() => {});
const UNIT = "ثلاجة الاختبار";
const EQ = "محرار الاختبار";

// 1. A fridge, 2–8 °C.
await p.goto(H + "/cold-chain/units", { waitUntil: "networkidle" });
check("the menu has the cold-chain station", (await p.locator('a[href="/cold-chain/temperatures"]').count()) > 0);
await p.fill('input[name="name"]', UNIT);
await p.locator('form:has([name="min_temp"]) button[type="submit"]').click();
await p.getByTestId("unit-list").waitFor({ timeout: 30_000 }).catch(() => {});
check("the fridge is added", (await p.getByTestId("unit-list").innerText().catch(() => "")).includes(UNIT));

// 2. This morning: 4.5 and this evening 11 — out of range.
await p.goto(H + "/cold-chain/temperatures", { waitUntil: "networkidle" });
const row = p.locator(`tr[data-unit="${UNIT}"]`);
await row.locator('input[name^="v:"][name$=":AM"]').fill("4.5");
await row.locator('input[name^="v:"][name$=":PM"]').fill("11");
await p.getByRole("button", { name: "حفظ القراءات" }).click();
await p.waitForURL(/saved=/, { timeout: 30_000 }).catch(() => {});
await settle();
check("an out-of-range reading is marked", (await row.locator('[data-bad="1"]').count()) === 1);
check("and raises an alarm until something is done", (await p.getByTestId("cc-alarm").count()) === 1);
await row.locator('input[name^="a:"]').fill("نُقلت الكواشف إلى الثلاجة الاحتياطية");
await p.getByRole("button", { name: "حفظ القراءات" }).click();
await p.waitForTimeout(1500);
await settle();
check("writing the action clears the alarm", (await p.getByTestId("cc-alarm").count()) === 0);

// 3. The month sheet.
await row.getByRole("link").click();
await p.waitForURL(/\/cold-chain\/temperatures\/[0-9a-f-]{36}/, { timeout: 30_000 }).catch(() => {});
await settle();
const stats = await p.getByTestId("month-stats").innerText().catch(() => "");
check("the month sheet counts the reading out of range", /خارج المدى:\s*1/.test(stats), stats);
check("and shows the action taken", (await p.locator("body").innerText()).includes("نُقلت الكواشف"));

// 4. An instrument calibrated every 6 months, with a weekly task.
await p.goto(H + "/cold-chain/equipment", { waitUntil: "networkidle" });
await p.fill('input[name="name"]', EQ);
await p.fill('input[name="calib_months"]', "6");
await p.fill('input[name="last_calibrated"]', "2025-01-01");
await p.locator('form:has([name="calib_months"]) button[type="submit"]').click();
await p.waitForURL(/\/cold-chain\/equipment\/[0-9a-f-]{36}/, { timeout: 30_000 }).catch(() => {});
await settle();
check("the instrument is added, its calibration overdue", (await p.getByTestId("calibration").getAttribute("class").catch(() => ""))?.includes("red") ?? false);
await p.locator('form:has([name="freq"]) input[name="name"]').fill("تنظيف ومراجعة");
await p.locator('form:has([name="freq"]) button[type="submit"]').click();
await p.getByTestId("task-list").waitFor({ timeout: 30_000 }).catch(() => {});
check("a task never done is due", (await p.locator('[data-due="1"]').count()) === 1);
await p.getByRole("button", { name: /أُنجزت اليوم/ }).click();
await p.waitForTimeout(1500);
await settle();
check("done today, it is no longer due", (await p.locator('[data-due="1"]').count()) === 0);
await p.locator('select[name="log_type"]').selectOption("calibration");
await p.fill('input[name="details"]', "معايرة لدى شركة الصيانة");
await p.locator('form:has([name="log_type"]) button[type="submit"]').click();
await p.getByTestId("log-list").waitFor({ timeout: 30_000 }).catch(() => {});
await settle();
check("a calibration entry makes it current again", !((await p.getByTestId("calibration").getAttribute("class").catch(() => "")) ?? "").includes("red"));
check("the station uses 1234 digits", !/[٠-٩]/.test(await p.locator("body").innerText()));
check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
