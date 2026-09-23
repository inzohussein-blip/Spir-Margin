// Backup, restore and connecting a hosted database — the three things that
// stand between this company and losing its records.
import { H, SHOT, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("settings");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1280, height: 1200 } });
const errs = [];
const p = await signIn(ctx);
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

await p.goto(H + "/settings", { waitUntil: "domcontentloaded", timeout: 120000 });
await p.waitForTimeout(1500);
const text = await p.locator("body").innerText();

check("settings offers a backup", text.includes("النسخ الاحتياطي والاستعادة"));
check("it warns this is the only other copy", text.includes("النسخة الأخرى الوحيدة"));
check("settings points to Sync for linking computers", text.includes("المزامنة") && text.includes("افتح المزامنة"));
check("no Arabic-Indic digits", !/[٠-٩]/.test(text));

// The backup must actually download, and be a real gzip.
const res = await p.request.get(H + "/api/backup");
check("a backup downloads", res.status() === 200, `status ${res.status()}`);
const body = await res.body();
check("it is a gzip file", body[0] === 0x1f && body[1] === 0x8b, `magic ${body[0]},${body[1]}`);
check("and is not empty", body.length > 100000, `${Math.round(body.length / 1024)} KB`);
check(
  "it is offered as a named download",
  (res.headers()["content-disposition"] ?? "").includes("spir-margin-"),
  res.headers()["content-disposition"] ?? "(none)",
);

// The hosted database is set on the Sync page now; Settings points there.
check("Settings points to the Sync page", (await p.locator('a[href="/sync"]').count()) > 0);
await p.goto(H + "/sync", { waitUntil: "networkidle" });
check("the Sync page says nothing is configured", (await p.locator("body").innerText()).includes("لا شيء مضبوط"));

// A bad connection string must be refused rather than saved.
await p.fill('input[name="database_url"]', "postgresql://nobody@127.0.0.1:1/none");
await p.locator('form:has(input[name="database_url"]) button[type="submit"]').click();
await p.waitForTimeout(15000);
const after = await p.locator("body").innerText();
check("a connection that fails is not saved", after.includes("تعذّر") || after.includes("لا شيء مضبوط"));
const alerts = await p.locator('[role="alert"]').allInnerTexts();
check("and says so in Arabic, with the database's own words beside it",
  alerts.some((a) => a.includes("تعذّر الاتصال")), JSON.stringify(alerts).slice(0, 300));

// Supabase's transaction pooler cannot carry the migrator's lock, so it is
// refused before any connection is tried, with what to pick instead.
await p.fill('input[name="database_url"]', "postgresql://postgres.x:pw@aws-0-x.pooler.supabase.com:6543/postgres");
await p.locator('form:has(input[name="database_url"]) button[type="submit"]').click();
const pooler = p.locator('[role="alert"]', { hasText: "6543" });
await pooler.waitFor({ timeout: 20_000 }).catch(() => {});
check("the transaction pooler is refused, naming what to use", (await pooler.innerText().catch(() => "")).includes("Session pooler"));
check("no uncaught page errors", errs.length === 0, errs.slice(0, 2).join(" | "));

await p.screenshot({ path: `${SHOT}/settings.png`, fullPage: true });
done();
await browser.close();
