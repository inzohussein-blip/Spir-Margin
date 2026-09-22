// "Today" is Baghdad's today.
//
// Forms used to default their date with new Date().toISOString().slice(0, 10)
// — today in UTC, which in Iraq (UTC+3) is yesterday from midnight to 3 a.m.
// The browser clock is pinned to the worst case: 01:30 on New Year's night in
// Baghdad, still 31 December in UTC.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("dates");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", timezoneId: "Asia/Baghdad" });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);

const NEW_YEARS_NIGHT = new Date("2025-12-31T22:30:00Z"); // 01:30, 1 Jan 2026 in Baghdad
await p.clock.setFixedTime(NEW_YEARS_NIGHT);

for (const [path, label] of [
  ["/sale-requests/new", "a sales request"],
  ["/authorizations/new", "a transport authorization"],
]) {
  await p.goto(H + path, { waitUntil: "networkidle" });
  const value = await p.locator('input[type="date"]').first().inputValue();
  check(`${label} is dated by Baghdad's calendar`, value === "2026-01-01", value);
}

await browser.close();
done();
