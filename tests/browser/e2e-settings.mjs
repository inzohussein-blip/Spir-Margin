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
check("settings offers a hosted database", text.includes("القاعدة المستضافة"));
check("it says nothing is configured", text.includes("لا شيء مضبوط"));
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

// A bad connection string must be refused rather than saved.
await p.fill('input[name="database_url"]', "postgresql://nobody@127.0.0.1:1/none");
await p.locator('form:has(input[name="database_url"]) button[type="submit"]').click();
await p.waitForTimeout(15000);
const after = await p.locator("body").innerText();
check("a connection that fails is not saved", after.includes("تعذّر") || after.includes("Could not connect") || after.includes("لا شيء مضبوط"));
check("no uncaught page errors", errs.length === 0, errs.slice(0, 2).join(" | "));

await p.screenshot({ path: `${SHOT}/settings.png`, fullPage: true });
done();
await browser.close();
