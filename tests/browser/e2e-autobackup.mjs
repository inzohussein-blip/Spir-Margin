// Automatic backups: the schedule, the folder, "back up now", the list, the
// download, and the safety copy a restore takes first.
import { mkdtempSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("automatic backups");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1300, height: 1100 } });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
const folder = mkdtempSync(join(tmpdir(), "spir-backups-"));
const panel = () => p.locator("#auto-backup");

await p.goto(H + "/settings", { waitUntil: "networkidle" });
check("Settings has the automatic backups panel", (await panel().count()) === 1);
check("on by default, with a next time", (await panel().innerText()).includes("التالية"));

// A folder the program cannot use is refused.
await panel().locator('input[name="folder"]').fill("relative/path");
await panel().getByRole("button", { name: "احفظ الجدول" }).click();
await panel().locator('[role="alert"]').waitFor({ timeout: 20_000 }).catch(() => {});
check("a folder that is not a full path is refused", (await panel().locator('[role="alert"]').innerText().catch(() => "")).includes("لا يستطيع البرنامج"));

// A real one, every 6 hours.
await p.goto(H + "/settings", { waitUntil: "networkidle" });
await panel().locator('select[name="frequency"]').selectOption("hours");
await panel().locator('input[name="every_hours"]').fill("6");
await panel().locator('input[name="folder"]').fill(folder);
await panel().locator('input[name="keep"]').fill("3");
await panel().getByRole("button", { name: "احفظ الجدول" }).click();
await p.waitForURL(/backup=saved/, { timeout: 30_000 }).catch(() => {});
check("the schedule is saved", (await p.locator('[role="status"]').first().innerText().catch(() => "")).includes("حُفظ"));
check("and kept", (await panel().locator('select[name="frequency"]').inputValue()) === "hours");

// Back up now, a few times: only `keep` stay.
for (let i = 0; i < 4; i++) {
  await p.goto(H + "/settings", { waitUntil: "networkidle" });
  await panel().getByRole("button", { name: "انسخ الآن" }).click();
  await p.waitForURL(/backup=done/, { timeout: 60_000 }).catch(() => {});
  await p.waitForTimeout(1100); // names are to the second
}
const files = readdirSync(folder).filter((f) => f.startsWith("spir-margin-auto-"));
check("backups land in the chosen folder", files.length > 0, files.join(","));
check("only the newest 3 are kept", files.length === 3, String(files.length));
await p.goto(H + "/settings", { waitUntil: "networkidle" });
check("they are listed", (await p.getByTestId("backup-files").locator("li").count()) === 3);

const link = await p.getByTestId("backup-files").locator("a").first().getAttribute("href");
const res = await p.request.get(H + link);
const body = await res.body();
check("a listed backup downloads as a real gzip", res.status() === 200 && body[0] === 0x1f && body[1] === 0x8b);
check("a name outside the folder is refused", (await p.request.get(H + "/api/backup/file?name=../../etc/passwd")).status() === 404);

// A file that is not a backup is refused before anything is touched.
const junk = join(folder, "not-a-backup.tar.gz");
writeFileSync(junk, "hello");
await p.goto(H + "/settings", { waitUntil: "networkidle" });
const restore = p.locator("form:has(input[type=file])").first();
await restore.locator("input[type=file]").setInputFiles(junk);
await restore.locator('input[type="checkbox"]').check();
await restore.locator('button[type="submit"]').click();
await p.waitForTimeout(8000);
const after = await p.locator("body").innerText();
check("a file that is not a backup is refused", after.includes("تعذّر") || after.includes("ليس"));
check("and the data is still there", (await (await p.request.get(H + "/labs")).text()).includes("LAB-001"));
check("a safety copy was taken first", readdirSync(folder).some((f) => f.startsWith("spir-margin-before-restore-")));

check("no uncaught page errors", errs.length === 0, errs.join(" | "));
await browser.close();
done();
