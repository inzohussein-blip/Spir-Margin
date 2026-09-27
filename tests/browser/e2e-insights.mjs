// Insights and the calendar: twelve month columns with a value on hover and a
// table view; the calendar draws whole weeks, and a day opens its list.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("insights & calendar");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 1000 } });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

await p.goto(H + "/insights", { waitUntil: "networkidle" });
check("the menu has insights and the calendar", (await p.locator('a[href="/insights"]').count()) > 0 && (await p.locator('a[href="/calendar"]').count()) > 0);
check("four figure tiles", (await p.getByTestId("insight-tiles").locator(":scope > *").count()) === 4);
// The demo records may be older than a year: then the chart says so instead.
const months = p.getByTestId("chart-months");
const cols = months.locator("[data-column]");
if (await cols.count()) {
  check("twelve month columns", (await cols.count()) === 12, String(await cols.count()));
  check("each column names its value", /:\s*\S/.test((await cols.last().getAttribute("title")) ?? ""));
} else {
  check("no sales in 12 months is said", (await months.innerText()).includes("لا مبيعات في آخر 12 شهراً"));
}
check("the aging chart is drawn", (await p.getByTestId("chart-aging").count()) === 1);
const body = await p.locator("body").innerText();
check("no Arabic-Indic digits (insights)", !/[٠-٩]/.test(body));

await p.goto(H + "/calendar?month=2026-09", { waitUntil: "networkidle" });
const days = p.getByTestId("calendar-grid").locator("[data-day]");
const n = await days.count();
check("whole weeks", n > 0 && n % 7 === 0, String(n));
check("starting on Saturday", (await days.first().getAttribute("data-day")) === "2026-08-29");
check("the legend lists the kinds", (await p.getByTestId("calendar-legend").locator("span").count()) === 7);
await p.locator('[data-day="2026-09-15"]').click();
await p.waitForURL(/day=2026-09-15/);
const opened = await p.getByTestId("calendar-day").getByText("2026-09-15").waitFor({ timeout: 30_000 }).then(() => true, () => false);
check("a day opens its list", opened);
check("no Arabic-Indic digits (calendar)", !/[٠-٩]/.test(await p.locator("body").innerText()));
check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
