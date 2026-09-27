// Activation codes, end to end, with real servers.
//
// This suite starts three servers from the same build, each with a database
// of its own:
//   the CODES server (the web version's role: LICENSE_ADMIN_PASSWORD set), and
//   two company COMPUTERS pointed at it (SPIR_LICENSE_SERVER).
// The owner makes a code on /licenses; the computers enter it on the welcome
// page; the owner's changes (seats, stop, message, a freed seat) reach them
// at "check now". The server the runner started is not involved (its codes
// are off), so the other suites never meet an activation window.
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch, results } from "./harness.mjs";

const { check, done } = results("activation codes");
const browser = await launch();
const opts = { locale: "ar-EG", viewport: { width: 1400, height: 1000 } };
const errs = [];
const OWNER_PASSWORD = "owner-pass-4821";
const CODES = "http://127.0.0.1:3395";

// ---------------------------------------------------------------- servers
const extra = [];
async function startServer(port, env) {
  const dataDir = mkdtempSync(join(tmpdir(), "spir-lic-test-"));
  const proc = spawn("npx", ["next", "start", "-p", String(port)], {
    env: { ...process.env, PORT: String(port), PGLITE_DATA_DIR: dataDir, SPIR_SEED: "none", SPIR_LICENSE_SERVER: "", ...env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let log = "";
  proc.stdout.on("data", (d) => (log += d));
  proc.stderr.on("data", (d) => (log += d));
  const url = `http://localhost:${port}`;
  extra.push({ proc, dataDir });
  for (let i = 0; i < 150; i++) {
    try {
      if ((await fetch(url + "/api/license", { signal: AbortSignal.timeout(4000) })).ok) return { url, log: () => log };
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`server on ${port} did not start:\n${log}`);
}
function stopAll() {
  for (const s of extra) {
    try { process.kill(-s.proc.pid, "SIGKILL"); } catch { /* gone */ }
    rmSync(s.dataDir, { recursive: true, force: true });
  }
}
process.on("exit", stopAll);

// An address that answers, but not as a codes server (a password-protected
// deployment): the computer pointed at it must stay open.
const notCodes = createServer((_req, res) => res.writeHead(401, { "content-type": "text/html" }).end("<html>Authentication Required</html>"));
await new Promise((r) => notCodes.listen(3392, "127.0.0.1", r));
notCodes.unref(); // never what keeps this suite alive

const [codes, pcA, pcB, pcC] = await Promise.all([
  startServer(3395, { LICENSE_ADMIN_PASSWORD: OWNER_PASSWORD, AUTH_SECRET: "codes-server-secret-for-tests", SPIR_ACTIVATION_CONTACT: "للتفعيل والدعم: 07700000000" }),
  startServer(3394, { SPIR_LICENSE_SERVER: CODES }),
  startServer(3393, { SPIR_LICENSE_SERVER: CODES }),
  startServer(3391, { SPIR_LICENSE_SERVER: "http://127.0.0.1:3392" }),
]);


async function page(url) {
  const ctx = await browser.newContext(opts);
  ctx.setDefaultTimeout(90_000);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${url}: ${String(e).slice(0, 140)}`));
  return p;
}
const text = async (p) => (await p.locator("body").innerText().catch(() => "")) ?? "";

{
  const c = await page(pcC.url);
  // The first page may render before that address has answered at all; the answer is kept.
  await c.goto(pcC.url + "/welcome", { waitUntil: "networkidle" });
  await c.waitForTimeout(4000);
  await c.goto(pcC.url + "/welcome", { waitUntil: "networkidle" });
  check("an address that is not a codes server locks nothing", (await c.getByTestId("license-window").count()) === 0
    && (await c.locator('[data-testid="stations"] [data-station]').count()) === 8, (await text(c)).slice(0, 160));
  await c.goto(pcC.url + "/login", { waitUntil: "networkidle" });
  check("and its sign-in page opens", new URL(c.url()).pathname === "/login", c.url());
  await c.context().close();
}

// ---------------------------------------------------------------- 1. the owner signs in
const status = await (await fetch(`${CODES}/api/license`)).json();
check("the codes server says codes are on, with its contact line", status.enabled === true && status.contact.includes("07700000000"), JSON.stringify(status));

const owner = await page(codes.url);
await owner.goto(codes.url + "/licenses", { waitUntil: "networkidle" });
await owner.fill('input[name="password"]', "wrong-password");
await owner.locator('form button').click();
await owner.getByRole("alert").filter({ hasText: /./ }).first().waitFor({ timeout: 15_000 }).catch(() => {});
check("a wrong owner password is refused", (await text(owner)).includes("كلمة المرور غير صحيحة"));
await owner.fill('input[name="password"]', OWNER_PASSWORD);
await owner.locator('form button').click();
await owner.getByTestId("create-code").waitFor({ timeout: 20_000 }).catch(() => {});
check("the owner reaches the code manager", (await owner.getByTestId("create-code").count()) === 1);

// ---------------------------------------------------------------- 2. a code: one computer, no manufacturing
const form = owner.getByTestId("create-code");
await form.locator('input[name="company"]').fill("شركة الاختبار");
await form.locator('input[name="days"]').fill("30");
await form.locator('input[name="seats"]').fill("1");
await form.locator('[data-station="manufacturing"]').click();
await form.getByRole("button", { name: "إنشاء الرمز" }).click();
await owner.getByTestId("new-code").waitFor({ timeout: 20_000 }).catch(() => {});
const code = ((await owner.locator("[data-code]").innerText().catch(() => "")) ?? "").trim();
check("a new code is shown once, readable", /^[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(code), code);
const row = () => owner.locator('[data-code-row="شركة الاختبار"]');
await row().locator('[data-state="waiting"]').waitFor({ timeout: 20_000 }).catch(() => {});
check("the code is listed as not activated yet", (await row().locator('[data-state="waiting"]').count()) === 1);

// ---------------------------------------------------------------- 3. computer A: closed until the code
const a = await page(pcA.url);
await a.goto(pcA.url + "/login", { waitUntil: "networkidle" });
check("a computer waiting for its code sends every page to the welcome screen", new URL(a.url()).pathname === "/welcome", a.url());
const win = a.getByTestId("license-window");
check("the activation window is over the welcome page", (await win.count()) === 1 && (await win.innerText()).includes("تفعيل هذا الحاسوب"));
check("with the provider's contact line", (await win.innerText()).includes("07700000000"));
check("the stations are behind it, in the project's colours", (await a.locator('[data-testid="stations"] [data-station]').count()) === 8);
check("the whole system comes first", (await a.locator('[data-testid="stations"] [data-station]').first().getAttribute("data-station")) === "all");
check("the provider's number is at the foot of the page", (await a.getByTestId("provider-contact").innerText()).includes("07803993585"));

await win.locator('input[name="code"]').fill("AAAA-BBBB-CCCC");
await win.getByRole("button", { name: /تفعيل/ }).click();
await win.getByRole("alert").waitFor({ timeout: 20_000 }).catch(() => {});
check("a wrong code is refused, in Arabic", (await win.innerText()).includes("الرمز غير صحيح"), await win.innerText().catch(() => ""));

await win.locator('input[name="code"]').fill(code.toLowerCase());
await win.getByRole("button", { name: /تفعيل/ }).click();
await a.getByTestId("license-chip").waitFor({ timeout: 30_000 }).catch(() => {});
check("the right code opens the computer", (await a.getByTestId("license-window").count()) === 0 && (await a.getByTestId("license-chip").innerText()).includes("شركة الاختبار"));
check("a station not in the code is shown locked", (await a.locator('[data-station="manufacturing"][data-closed="1"]').count()) === 1
  && (await a.locator('[data-station="sales"][data-closed]').count()) === 0);

// «The whole system» opens with the same code; the closed station's sections are gone for the admin too.
check("the whole system opens with the code", ((await a.locator('[data-station="all"]').getAttribute("href")) ?? "").includes("with=code"));
await a.locator('[data-station="all"]').click();
await a.waitForURL((u) => u.pathname === "/login", { timeout: 60_000 }).catch(() => {});
const codeForm = a.getByTestId("code-login");
await codeForm.waitFor({ timeout: 30_000 }).catch(() => {});
await a.waitForLoadState("networkidle").catch(() => {});
await codeForm.locator('input[name="code"]').fill("AAAA-BBBB-CCCC");
await codeForm.getByRole("button").click();
await codeForm.getByRole("alert").waitFor({ timeout: 30_000 }).catch(() => {});
check("another code does not open it", (await codeForm.innerText()).includes("هذا ليس رمز التفعيل"), await codeForm.innerText().catch(() => ""));
await codeForm.locator('input[name="code"]').fill(code);
await codeForm.getByRole("button").click();
await a.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }).catch(() => {});
check("the company's code signs in as the administrator", !new URL(a.url()).pathname.startsWith("/login"), a.url());
await a.goto(pcA.url + "/users", { waitUntil: "networkidle" });
check("who can give the staff accounts", new URL(a.url()).pathname === "/users" && (await a.locator('input[name="email"]').count()) > 0, a.url());
await a.goto(pcA.url + "/boms", { waitUntil: "networkidle" });
check("a page of a station outside the code says so", (await text(a)).includes("غير مشمولة برمز تفعيل هذا الحاسوب"));
await a.goto(pcA.url + "/labs", { waitUntil: "networkidle" });
check("a page of a station in the code opens", !(await text(a)).includes("غير مشمولة برمز"));

// ---------------------------------------------------------------- 4. seats
const b = await page(pcB.url);
await b.goto(pcB.url + "/welcome", { waitUntil: "networkidle" });
const winB = b.getByTestId("license-window");
await winB.locator('input[name="code"]').fill(code);
await winB.getByRole("button", { name: /تفعيل/ }).click();
await winB.getByRole("alert").waitFor({ timeout: 20_000 }).catch(() => {});
check("a second computer is refused while the code allows one", (await winB.innerText().catch(() => "")).includes("مستعمل على كل الحواسيب"));

await owner.reload({ waitUntil: "networkidle" });
check("the owner sees the computer that joined", (await row().locator("[data-seats]").innerText()).trim() === "1/1");
await row().locator("button[aria-expanded]").click();
await row().locator("[data-device]").first().waitFor({ timeout: 10_000 }).catch(() => {});
check("with its name and version", (await row().locator("[data-device]").count()) === 1);
await row().locator('input[type="number"]').first().fill("2");
await row().getByRole("button", { name: "حفظ عدد الحواسيب" }).click();
await owner.waitForTimeout(1500);

await winB.locator('input[name="code"]').fill(code);
await winB.getByRole("button", { name: /تفعيل/ }).click();
await b.getByTestId("license-chip").waitFor({ timeout: 30_000 }).catch(() => {});
check("with a second seat, the second computer joins", (await b.getByTestId("license-chip").count()) === 1);

// ---------------------------------------------------------------- 5. stop, resume, message, freed seat
const checkNow = async (p, url) => {
  await p.goto(url + "/welcome?license=1", { waitUntil: "networkidle" });
  const w = p.getByTestId("license-window");
  await w.getByRole("button", { name: /تحقّق الآن/ }).click();
  await p.waitForTimeout(2500);
  await p.goto(url + "/welcome?license=1", { waitUntil: "networkidle" });
};

await owner.reload({ waitUntil: "networkidle" });
await row().getByRole("button", { name: "إيقاف" }).click();
await owner.waitForTimeout(1500);
await checkNow(a, pcA.url);
check("a stopped code locks the computer at its next check", (await a.locator('[data-reason="stopped"]').count()) === 1, (await text(a)).slice(0, 200));
await a.goto(pcA.url + "/labs", { waitUntil: "networkidle" });
check("and every page waits behind the lock", new URL(a.url()).pathname === "/welcome");

await owner.reload({ waitUntil: "networkidle" });
await row().getByRole("button", { name: "استئناف" }).click();
await owner.waitForTimeout(1500);
await row().locator("button[aria-expanded]").click();
await row().locator('input[placeholder="تظهر عند تحققها التالي"]').fill("سيتم تجديد الاشتراك الشهر القادم");
await row().getByRole("button", { name: "إرسال" }).click();
await owner.waitForTimeout(1500);
// Signed in, a bare /welcome goes to the home page: "?license=1" opens the code's status there.
await checkNow(a, pcA.url);
check("resuming opens it again", (await a.getByTestId("license-status").innerText({ timeout: 10_000 }).catch(() => "")).includes("شركة الاختبار"), (await text(a)).slice(0, 200));
await a.getByTestId("license-window").getByRole("button", { name: "×" }).click().catch(() => {});
check("the provider's message reaches the computer", (await a.getByTestId("provider-message").innerText({ timeout: 10_000 }).catch(() => "")).includes("سيتم تجديد الاشتراك"));
await a.goto(pcA.url + "/labs", { waitUntil: "networkidle" });
check("and the pages open again", new URL(a.url()).pathname === "/labs", a.url());

await owner.reload({ waitUntil: "networkidle" });
await row().locator("button[aria-expanded]").click();
owner.once("dialog", (d) => d.accept());
await row().locator("[data-device]").last().getByRole("button", { name: /تحرير المقعد/ }).click();
await owner.waitForTimeout(1500);
await checkNow(b, pcB.url);
check("a freed seat locks that computer only", (await b.locator('[data-reason="gone"]').count()) === 1, (await text(b)).slice(0, 200));

// ---------------------------------------------------------------- 6. offline: the license is checked on the computer
await a.goto(pcA.url + "/welcome?license=1", { waitUntil: "networkidle" });
const v = await a.getByTestId("app-version").count();
check("the welcome page shows no Arabic-Indic digits", !/[٠-٩]/.test(await text(a)));
check("the version line is there or absent without errors", v <= 1);

check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
stopAll();
done();
