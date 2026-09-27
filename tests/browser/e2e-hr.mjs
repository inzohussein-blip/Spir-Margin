// Staff & shifts (migration 0117), end to end on the runner's server:
// shifts, an employee, today's roster cell, «Arrived» / «Left», a leave, an
// advance, and the payroll sheet that takes it off the salary.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("staff & shifts");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1440, height: 1000 } });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
const body = async () => (await p.locator("body").innerText().catch(() => "")) ?? "";
const settle = () => p.waitForLoadState("networkidle").catch(() => {});
const NAME = "موظف الاختبار";
const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

// 1. The sidebar has the station; the shifts come with one click.
await p.goto(H + "/hr/shifts", { waitUntil: "networkidle" });
check("the menu has the staff station", (await p.locator('a[href="/hr/attendance"]').count()) > 0);
if (await p.getByTestId("usual-shifts").count()) {
  await p.getByTestId("usual-shifts").click();
  await p.getByTestId("shift-list").waitFor({ timeout: 30_000 }).catch(() => {});
}
check("the usual shifts are added", (await p.getByTestId("shift-list").innerText().catch(() => "")).includes("صباحي"));

// 2. An employee.
await p.goto(H + "/hr/employees/new", { waitUntil: "networkidle" });
await p.fill('input[name="full_name"]', NAME);
await p.fill('input[name="base_salary"]', "900000");
await p.locator('form:has([name="full_name"]) button[type="submit"]').click();
await p.waitForURL((u) => u.pathname === "/hr/employees", { timeout: 60_000 }).catch(() => {});
await settle();
check("the employee is saved", (await body()).includes(NAME), p.url());

// 3. On the morning shift today.
await p.goto(H + "/hr/roster", { waitUntil: "networkidle" });
const row = p.locator(`tr[data-employee="${NAME}"]`);
const cell = row.locator(`select[data-cell$="|${today}"]`);
await cell.waitFor({ timeout: 30_000 }).catch(() => {});
const morning = await cell.locator("option", { hasText: "صباحي" }).first().getAttribute("value");
await cell.selectOption(morning ?? "");
await p.waitForTimeout(1500);
await p.reload({ waitUntil: "networkidle" });
check("today's shift is saved on the roster", (await row.locator(`select[data-cell$="|${today}"]`).inputValue().catch(() => "")) === morning);

// 4. Arrived, then left.
await p.goto(H + "/hr/attendance", { waitUntil: "networkidle" });
const arow = p.locator(`tr[data-employee="${NAME}"]`);
await arow.getByRole("button", { name: /وصل/ }).click();
await p.waitForURL(/saved=|\/hr\/attendance/, { timeout: 30_000 }).catch(() => {});
await settle();
await arow.getByRole("button", { name: /انصرف/ }).waitFor({ timeout: 30_000 }).catch(() => {});
const st = await arow.locator("[data-status]").getAttribute("data-status").catch(() => "");
check("arriving is recorded, on time or late", st === "present" || st === "late", st ?? "");
await arow.getByRole("button", { name: /انصرف/ }).click();
await p.waitForTimeout(1500);
await settle();
check("and leaving", /\d\d:\d\d/.test((await arow.locator("td").nth(4).innerText().catch(() => "")).trim()));

// 5. A leave next month and an advance this month.
await p.goto(H + "/hr/leaves", { waitUntil: "networkidle" });
await p.locator('select[name="employee_id"]').selectOption({ label: NAME });
await p.locator('select[name="leave_type"]').selectOption("annual");
await p.fill('input[name="from_date"]', `${today.slice(0, 4)}-12-20`);
await p.fill('input[name="to_date"]', `${today.slice(0, 4)}-12-22`);
await p.locator('form:has([name="leave_type"]) button[type="submit"]').click();
await p.getByTestId("leaves-table").waitFor({ timeout: 30_000 }).catch(() => {});
check("the leave is recorded, three days", (await p.getByTestId("leaves-table").innerText().catch(() => "")).includes(NAME));
check("and taken off the annual balance", (await p.getByTestId("leave-balances").innerText().catch(() => "")).includes("17"));

await p.goto(H + "/hr/advances", { waitUntil: "networkidle" });
await p.locator('select[name="employee_id"]').selectOption({ label: NAME });
await p.fill('input[name="amount"]', "150000");
await p.locator('form:has([name="amount"]) button[type="submit"]').click();
await p.getByTestId("advances-table").waitFor({ timeout: 30_000 }).catch(() => {});
check("the advance is recorded", (await p.getByTestId("advances-table").innerText().catch(() => "")).includes(NAME));

// 6. The payroll takes it off the salary.
await p.goto(H + "/hr/payroll", { waitUntil: "networkidle" });
const net = await p.locator(`tr[data-employee="${NAME}"] [data-net]`).innerText().catch(() => "");
check("the payroll is the salary less the advance", net.replace(/[^\d]/g, "") === "750000", net);
check("the station's pages use 1234 digits", !/[٠-٩]/.test(await body()));

// 7. The welcome page shows the new station.
const ctx2 = await browser.newContext({ locale: "ar-EG" });
const w = await ctx2.newPage();
await w.goto(H + "/welcome", { waitUntil: "networkidle" });
check("the welcome page has the staff station", (await w.locator('[data-station="hr"]').count()) === 1);
await ctx2.close();

check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
