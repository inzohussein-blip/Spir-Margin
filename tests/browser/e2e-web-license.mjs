// The web version as its own codes server, each BROWSER a device (the way
// spir-lab-manager's web version works): the first visit asks for the code,
// a second browser is refused while the code allows one, «the whole system»
// opens with the same code, and a stop reaches the browser at "check now".
// Its own server on :3389 in web mode (SPIR_WEB_LICENSE=1, what Vercel is).
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { launch, results } from "./harness.mjs";

const { check, done } = results("web activation");
const browser = await launch();
const opts = { locale: "ar-EG", viewport: { width: 1400, height: 1000 } };
const errs = [];
const PASSWORD = "web-owner-7731";
const PORT = 3389;
const URL_ = `http://localhost:${PORT}`;

const dataDir = mkdtempSync(join(tmpdir(), "spir-web-lic-"));
const proc = spawn("npx", ["next", "start", "-p", String(PORT)], {
  env: {
    ...process.env, PORT: String(PORT), PGLITE_DATA_DIR: dataDir, SPIR_SEED: "none", SPIR_LICENSE_SERVER: "",
    SPIR_WEB_LICENSE: "1", LICENSE_ADMIN_PASSWORD: PASSWORD, AUTH_SECRET: "web-codes-secret-for-tests",
  },
  stdio: ["ignore", "pipe", "pipe"],
  detached: true,
});
let log = "";
proc.stdout.on("data", (d) => (log += d));
proc.stderr.on("data", (d) => (log += d));
const stop = () => { try { process.kill(-proc.pid, "SIGKILL"); } catch { /* gone */ } rmSync(dataDir, { recursive: true, force: true }); };
process.on("exit", stop);
let up = false;
for (let i = 0; i < 150 && !up; i++) {
  try { up = (await fetch(URL_ + "/api/license", { signal: AbortSignal.timeout(4000) })).ok; } catch { /* not yet */ }
  if (!up) await new Promise((r) => setTimeout(r, 2000));
}
if (!up) throw new Error(`server on ${PORT} did not start:\n${log}`);

async function page() {
  const ctx = await browser.newContext(opts);
  ctx.setDefaultTimeout(90_000);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  return p;
}
const text = async (p) => (await p.locator("body").innerText().catch(() => "")) ?? "";

// 1. The owner: /license (as people type it) leads to the code manager.
const owner = await page();
await owner.goto(URL_ + "/license", { waitUntil: "networkidle" });
check("/license leads to the code manager", new URL(owner.url()).pathname === "/licenses", owner.url());
await owner.fill('input[name="password"]', PASSWORD);
await owner.locator("form button").click();
await owner.getByTestId("panel-nav").waitFor({ timeout: 30_000 }).catch(() => {});
await owner.locator('[data-section="new"]').click();
await owner.getByTestId("create-code").waitFor({ timeout: 30_000 }).catch(() => {});
const form = owner.getByTestId("create-code");
await form.locator('input[name="company"]').fill("شركة الويب");
await form.locator('input[name="days"]').fill("30");
await form.locator('input[name="seats"]').fill("1");
await form.getByRole("button", { name: "إنشاء الرمز" }).click();
await owner.getByTestId("new-code").waitFor({ timeout: 20_000 }).catch(() => {});
const code = ((await owner.locator("[data-code]").innerText().catch(() => "")) ?? "").trim();
check("the owner makes a code", /^[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(code), code);

// 2. A browser's first visit asks for it.
const a = await page();
await a.goto(URL_ + "/", { waitUntil: "networkidle" });
const win = a.getByTestId("license-window");
check("the first visit shows the activation window", (await win.count()) === 1 && new URL(a.url()).pathname === "/welcome", a.url());
await win.locator('input[name="code"]').fill(code);
await win.getByRole("button", { name: /تفعيل/ }).click();
await a.getByTestId("license-chip").waitFor({ timeout: 30_000 }).catch(() => {});
check("the code opens this browser", (await a.getByTestId("license-window").count()) === 0 && (await a.getByTestId("license-chip").count()) === 1);
await a.goto(URL_ + "/welcome", { waitUntil: "networkidle" });
check("and it stays open on the next visit", (await a.getByTestId("license-window").count()) === 0);

// 3. Another browser is another device.
const b = await page();
await b.goto(URL_ + "/welcome", { waitUntil: "networkidle" });
const winB = b.getByTestId("license-window");
check("another browser is asked again", (await winB.count()) === 1);
await winB.locator('input[name="code"]').fill(code);
await winB.getByRole("button", { name: /تفعيل/ }).click();
await winB.getByRole("alert").waitFor({ timeout: 20_000 }).catch(() => {});
check("and refused while the code allows one device", (await winB.innerText().catch(() => "")).includes("مستعمل على كل الحواسيب"));

// 4. The whole system with the same code.
await a.goto(URL_ + "/welcome", { waitUntil: "networkidle" });
await a.locator('[data-station="all"]').click();
await a.waitForURL((u) => u.pathname === "/login", { timeout: 60_000 }).catch(() => {});
const cf = a.getByTestId("code-login");
await cf.waitFor({ timeout: 30_000 }).catch(() => {});
await a.waitForLoadState("networkidle").catch(() => {});
await cf.locator('input[name="code"]').fill(code);
await cf.getByRole("button").click();
await a.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 60_000 }).catch(() => {});
check("the whole system opens with the code", !new URL(a.url()).pathname.startsWith("/login") && !new URL(a.url()).pathname.startsWith("/welcome"), a.url());

// 5. A stop reaches the browser.
await owner.reload({ waitUntil: "networkidle" });
await owner.locator('[data-code-row="شركة الويب"]').getByRole("button", { name: "إيقاف" }).click();
await owner.waitForTimeout(1500);
await a.goto(URL_ + "/welcome?license=1", { waitUntil: "networkidle" });
await a.getByTestId("license-window").getByRole("button", { name: /تحقّق الآن/ }).click();
await a.waitForTimeout(2500);
await a.goto(URL_ + "/welcome?license=1", { waitUntil: "networkidle" });
check("a stopped code locks the browser", (await a.locator('[data-reason="stopped"]').count()) === 1, (await text(a)).slice(0, 160));

check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
stop();
done();
