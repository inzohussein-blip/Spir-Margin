// The web app (/app), end to end: the program running in the browser.
//
// A codes server of its own (:3389, LICENSE_ADMIN_PASSWORD set) makes a code
// and — when a real Postgres can be started here — links it to that Postgres
// as the company's database. Then, in Chromium:
//   - /app asks for the code; the code opens the app (the database is made in
//     the browser, the first sync brings the company's records);
//   - a lab is added and a product booked on the browser's own database;
//   - with the network cut the page opens again from the offline worker and a
//     sale is made at the point of sale; it waits, and goes up when the
//     network is back (checked in the company's Postgres);
//   - a second browser takes the same code and receives what the first made;
//   - signing out, and in again with the code, works without the network.
// Without Postgres (no initdb on this machine) the sync steps are skipped
// and said so.
import { spawn, execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, readdirSync, chmodSync } from "node:fs";
import { tmpdir, userInfo } from "node:os";
import { join } from "node:path";
import { launch, results } from "./harness.mjs";

const { check, done } = results("web app");
const PORT = 3389;
const CODES = `http://127.0.0.1:${PORT}`;
const OWNER_PASSWORD = "owner-pass-5512";
const errs = [];
const cleanup = [];
process.on("exit", () => { for (const f of cleanup.reverse()) try { f(); } catch { /* gone */ } });

// ---------------------------------------------------------------- Postgres
/** A throwaway Postgres cluster, or null when this machine has none. */
function startPostgres() {
  const roots = ["/usr/lib/postgresql", "/usr/local/opt"].filter(existsSync);
  let bin = null;
  for (const r of roots) for (const v of readdirSync(r).sort().reverse()) if (existsSync(join(r, v, "bin", "initdb"))) { bin ??= join(r, v, "bin"); }
  if (!bin) return null;
  const dir = mkdtempSync(join(tmpdir(), "spir-pg-"));
  chmodSync(dir, 0o777);
  const root = userInfo().uid === 0;
  const run = (cmd) => root ? execFileSync("su", ["postgres", "-c", cmd], { stdio: "pipe" }) : execFileSync("sh", ["-c", cmd], { stdio: "pipe" });
  try {
    run(`${bin}/initdb -D ${dir}/data -A trust -U postgres >/dev/null`);
    run(`${bin}/pg_ctl -D ${dir}/data -o "-p 5438 -k ${dir} -c listen_addresses=127.0.0.1" -l ${dir}/log -w start >/dev/null`);
  } catch (e) {
    console.log(`note  could not start Postgres: ${String(e.stderr ?? e).slice(0, 200)}`);
    return null;
  }
  cleanup.push(() => { run(`${bin}/pg_ctl -D ${dir}/data -m immediate stop >/dev/null`); rmSync(dir, { recursive: true, force: true }); });
  run(`${bin}/psql -h 127.0.0.1 -p 5438 -U postgres -qc "create database company"`);
  return {
    url: "postgresql://postgres@127.0.0.1:5438/company?sslmode=disable",
    sql: (q) => execFileSync(`${bin}/psql`, ["-h", "127.0.0.1", "-p", "5438", "-U", "postgres", "-d", "company", "-tAc", q], { encoding: "utf8" }).trim(),
  };
}

// ---------------------------------------------------------------- codes server
const dataDir = mkdtempSync(join(tmpdir(), "spir-webapp-test-"));
const proc = spawn("npx", ["next", "start", "-p", String(PORT)], {
  env: { ...process.env, PORT: String(PORT), PGLITE_DATA_DIR: dataDir, SPIR_SEED: "none", SPIR_LICENSE_SERVER: "", LICENSE_ADMIN_PASSWORD: OWNER_PASSWORD, AUTH_SECRET: "webapp-codes-secret-for-tests" },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let log = "";
proc.stdout.on("data", (d) => (log += d));
proc.stderr.on("data", (d) => (log += d));
cleanup.push(() => { process.kill(-proc.pid, "SIGKILL"); rmSync(dataDir, { recursive: true, force: true }); });
for (let i = 0; ; i++) {
  try { if ((await fetch(CODES + "/api/license", { signal: AbortSignal.timeout(4000) })).ok) break; } catch { /* not yet */ }
  if (i > 90) throw new Error(`codes server did not start:\n${log}`);
  await new Promise((r) => setTimeout(r, 2000));
}

let cookie = "";
async function owner(body) {
  const r = await fetch(CODES + "/api/license/admin", { method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(body) });
  const set = r.headers.get("set-cookie");
  if (set) cookie = set.split(";")[0];
  return r.json();
}
await owner({ op: "login", password: OWNER_PASSWORD });
const made = await owner({ op: "create", company: "شركة الويب", days: 30, seats: 3 });
check("the owner makes a code", !!made.ok && !!made.code);
const CODE = made.code;
const pg = startPostgres();
if (pg) {
  const linked = await owner({ op: "sync_set", id: made.row.id, conn: pg.url });
  check("the code carries the company's database", !!linked.ok, JSON.stringify(linked).slice(0, 160));
} else {
  console.log("note  no Postgres here: the sync steps are skipped");
}

// ---------------------------------------------------------------- browser
const browser = await launch();
async function context() {
  const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 900 } });
  ctx.setDefaultTimeout(90_000);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  return { ctx, p };
}
const syncState = (p) => p.getByTestId("local-sync").getAttribute("data-state");
async function settled(p, want = "ok", ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if ((await syncState(p).catch(() => null)) === want) return true;
    await p.waitForTimeout(500);
  }
  return false;
}
const text = async (p) => (await p.locator("body").innerText().catch(() => "")) ?? "";

const A = await context();
{
  const { p } = A;
  await p.goto(CODES + "/welcome");
  await p.getByTestId("open-web-app").click();
  await p.getByTestId("local-activate").waitFor();
  check("the welcome page leads to the web app", new URL(p.url()).pathname === "/app");
  check("/app asks for the code first", true);

  await p.fill("input[name=code]", "AAAA-BBBB-CCCC");
  await p.click("[data-testid=local-activate] button");
  await p.getByRole("alert").filter({ hasText: "غير صحيح" }).waitFor({ timeout: 30_000 }).catch(() => {});
  check("a wrong code is refused in Arabic", (await text(p)).includes("هذا الرمز غير صحيح"));

  const t0 = Date.now();
  await p.fill("input[name=code]", CODE);
  await p.click("[data-testid=local-activate] button");
  await p.getByTestId("local-app").waitFor({ timeout: 180_000 });
  check("the code opens the app on the browser's own database", true, `${((Date.now() - t0) / 1000).toFixed(1)} s`);
  check("the company's name is shown", (await p.getByTestId("local-company").innerText()) === "شركة الويب");
  if (pg) check("the first sync completes", await settled(p), await syncState(p));
  else check("without a company database the records stay here", (await syncState(p)) === "local");

  // A lab and a product, through the generic forms.
  await p.goto(CODES + "/app#/e/labs/new");
  await p.fill("[data-testid=form-labs] input[name=code]", "WL-1");
  await p.fill("[data-testid=form-labs] input[name=name]", "مختبر الويب");
  await p.click("[data-testid=form-labs] button:has-text('حفظ')");
  await p.getByTestId("record-labs").waitFor();
  check("a lab is added through its form", (await p.getByTestId("record-title").innerText()) === "مختبر الويب");
  await p.goto(CODES + "/app#/e/products/new");
  await p.fill("[data-testid=form-products] input[name=item_code]", "WEB-KIT");
  await p.fill("[data-testid=form-products] input[name=name]", "عدّة الويب");
  await p.selectOption("[data-testid=form-products] select[name=product_type]", "spare_part");
  await p.fill("[data-testid=form-products] input[name=default_buy_price]", "4");
  await p.fill("[data-testid=form-products] input[name=default_sell_price]", "10");
  await p.click("[data-testid=form-products] button:has-text('حفظ')");
  await p.getByTestId("record-products").waitFor();
  check("a product is added through its form", (await p.getByTestId("record-title").innerText()) === "عدّة الويب");
  await p.goto(CODES + "/app#/e/labs");
  await p.getByTestId("list-labs").getByText("مختبر الويب").waitFor();
  check("the labs list shows it", true);
  if (pg) {
    check("both go up to the company's database", await settled(p) && pg.sql("select count(*) from labs where code = 'WL-1'") === "1" && pg.sql("select count(*) from products where item_code = 'WEB-KIT'") === "1");
  }

  // Without the network: the page opens from the offline worker, the sale is booked here.
  await p.waitForTimeout(1500); // the worker has kept the page's files
  await A.ctx.setOffline(true);
  await p.reload();
  const back = await p.getByTestId("local-app").waitFor({ timeout: 60_000 }).then(() => true, () => false);
  check("the app opens with no network at all", back, back ? "" : (await text(p)).slice(0, 200));
  await p.goto(CODES + "/app#/pos").catch(() => {});
  await p.getByTestId("pos-search").waitFor({ timeout: 60_000 });
  await p.locator("select").first().selectOption({ label: "مختبر الويب (WL-1)" });
  await p.getByRole("button", { name: /عدّة الويب/ }).click();
  await p.getByRole("button", { name: "إتمام البيع" }).click();
  await p.getByText("تم تسجيل البيع").waitFor({ timeout: 30_000 }).catch(() => {});
  // The chip counts the changes waiting to be sent (a sale is several rows).
  await p.waitForFunction(() => /\d/.test(document.querySelector("[data-testid=local-sync]")?.textContent ?? ""), null, { timeout: 15_000 }).catch(() => {});
  const chip = await p.getByTestId("local-sync").innerText();
  check("the sale is booked offline and waits", (await syncState(p)) === "offline" && /\d/.test(chip), chip);

  await A.ctx.setOffline(false);
  if (pg) {
    await p.evaluate(() => window.dispatchEvent(new Event("online")));
    check("back online, the sale goes up", await settled(p) && pg.sql("select count(*) from sales") === "1", pg.sql("select count(*) from sales"));
  }
  await p.goto(CODES + "/app#/");
  await p.getByTestId("local-home").waitFor();
  await p.waitForFunction(() => document.querySelector("[data-testid=sales-today]")?.textContent !== "—", null, { timeout: 15_000 }).catch(() => {});
  check("today's sales count it", (await p.getByTestId("sales-today").innerText()) === "1", await p.getByTestId("sales-today").innerText());
}

{
  // Documents through the generic form: an invoice with a line, submitted and paid.
  const { p } = A;
  p.on("dialog", (d) => void d.accept());
  const pick = async (sel, term, option) => {
    await p.click(sel);
    await p.fill(sel, term);
    await p.getByRole("option", { name: option }).first().click();
  };
  await p.goto(CODES + "/app#/e/sales-invoices/new");
  await pick("[data-testid=form-sales-invoices] input[data-ref=lab_id]", "الويب", /مختبر الويب/);
  await pick("[data-line='0'] input[data-ref=product_id]", "عدّة", /عدّة الويب/);
  const rate = await p.inputValue("[data-line='0'] input[name=rate]");
  check("picking a product fills its price", Number(rate) === 10, rate);
  await p.fill("[data-line='0'] input[name=qty]", "3");
  await p.click("[data-testid=form-sales-invoices] button:has-text('حفظ')");
  await p.getByTestId("record-sales-invoices").waitFor();
  const title = await p.getByTestId("record-title").innerText();
  check("the invoice is numbered by itself", /-SI-\d{4}-\d{4}$/.test(title), title);
  check("its total is the line's", (await p.locator("[data-field=total_amount]").innerText()) === "30");
  const date = await p.locator("[data-field=posting_date]").innerText();
  check("dates read as dates (YYYY-MM-DD)", /^\d{4}-\d{2}-\d{2}$/.test(date.trim()), date);
  await p.click("[data-action=submit]");
  await p.locator("[data-status=unpaid]").waitFor({ timeout: 20_000 }).catch(() => {});
  check("submitting makes it unpaid", await p.locator("[data-status=unpaid]").count() > 0);
  await p.click("[data-action=pay]");
  check("the payment is filled with what is outstanding", Number(await p.inputValue("input[name=p_amount]")) === 30);
  await p.click("form:has(input[name=p_amount]) button:has-text('تسجيل دفعة')");
  await p.locator("[data-status=paid]").waitFor({ timeout: 20_000 }).catch(() => {});
  check("the payment settles it", await p.locator("[data-status=paid]").count() > 0);

  // Staff: an employee, and their check-in today.
  await p.goto(CODES + "/app#/e/employees/new");
  await p.fill("[data-testid=form-employees] input[name=full_name]", "سارة");
  await p.click("[data-testid=form-employees] button:has-text('حفظ')");
  await p.getByTestId("record-employees").waitFor();
  await p.goto(CODES + "/app#/attendance");
  await p.locator("[data-employee='سارة'] button:has-text('تسجيل دخول')").click();
  await p.waitForFunction(() => /\d\d:\d\d/.test(document.querySelector("[data-employee='سارة'] [data-in]")?.textContent ?? ""), null, { timeout: 15_000 }).catch(() => {});
  check("an employee checks in", /\d\d:\d\d/.test(await p.locator("[data-employee='سارة'] [data-in]").innerText()));

  // Cold chain: a fridge, and its morning reading out of range.
  await p.goto(CODES + "/app#/e/cold-units/new");
  await p.fill("[data-testid=form-cold-units] input[name=name]", "ثلاجة الكواشف");
  await p.click("[data-testid=form-cold-units] button:has-text('حفظ')");
  await p.getByTestId("record-cold-units").waitFor();
  await p.goto(CODES + "/app#/temperatures");
  const am = p.locator("[data-unit='ثلاجة الكواشف'] input[data-slot=AM]");
  await am.fill("11");
  await am.blur();
  await p.waitForFunction(() => document.querySelector("[data-unit='ثلاجة الكواشف'] input[data-slot=AM]")?.className.includes("red"), null, { timeout: 15_000 }).catch(() => {});
  check("a reading out of the safe range is marked", (await am.getAttribute("class")).includes("red"));

  if (pg) {
    check("the invoice, the check-in and the reading go up", await settled(p)
      && pg.sql("select status from sales_invoices where total_amount = 30") === "paid"
      && pg.sql("select count(*) from hr_attendance") === "1" && pg.sql("select value::int from cc_readings") === "11",
      [pg.sql("select status from sales_invoices"), pg.sql("select count(*) from hr_attendance"), pg.sql("select count(*) from cc_readings")].join(" / "));
  }

  // Every list of every station opens.
  const lists = await p.$$eval("[data-testid=local-nav] a[href^='#/e/']", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  const broken = [];
  for (const href of lists) {
    await p.goto(CODES + "/app" + href);
    const id = href.split("/")[2];
    const ok = await p.getByTestId(`list-${id}`).waitFor({ timeout: 15_000 }).then(() => true, () => false);
    if (!ok || (await p.locator(`[data-testid=list-${id}] [role=alert]`).count())) broken.push(id);
  }
  check(`all ${lists.length} lists open`, lists.length > 20 && broken.length === 0, broken.join(", "));
}

if (pg) {
  // A second browser, same code: it takes the company's records at its first open.
  const B = await context();
  const { p } = B;
  await p.goto(CODES + "/app");
  await p.fill("input[name=code]", CODE);
  await p.click("[data-testid=local-activate] button");
  await p.getByTestId("local-app").waitFor({ timeout: 180_000 });
  await p.goto(CODES + "/app#/sales");
  await p.getByText("مختبر الويب").first().waitFor({ timeout: 30_000 }).catch(() => {});
  const body = await text(p);
  check("a second browser receives the first one's lab and sale", body.includes("مختبر الويب") && body.includes("عدّة الويب"));
  await p.goto(CODES + "/app#/e/sales-invoices");
  await p.locator("[data-testid=list-sales-invoices] [data-status=paid]").first().waitFor({ timeout: 20_000 }).catch(() => {});
  check("and the paid invoice", await p.locator("[data-testid=list-sales-invoices] [data-status=paid]").count() === 1);
  await B.ctx.close();
}

{
  // Signing out and in again, with no network: checked on the browser itself.
  const { p } = A;
  await A.ctx.setOffline(true);
  await p.locator("header button[title]").last().click();
  await p.getByTestId("local-sign-in").waitFor();
  await p.fill("[data-testid=local-sign-in] input[name=code]", "WRONG-CODE-1234");
  await p.click("[data-testid=local-sign-in] button:not([type=button])");
  await p.getByRole("alert").waitFor({ timeout: 10_000 }).catch(() => {});
  check("a wrong code does not sign in", (await text(p)).includes("هذا ليس رمز تشغيل هذه الشركة"));
  await p.fill("[data-testid=local-sign-in] input[name=code]", CODE);
  await p.click("[data-testid=local-sign-in] button:not([type=button])");
  check("the code signs in again without the network", await p.getByTestId("local-app").waitFor({ timeout: 20_000 }).then(() => true, () => false));
  await A.ctx.setOffline(false);
}

const digits = /[٠-٩]/.test(await text(A.p));
check("Western digits only", !digits);
check("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
process.exit();
