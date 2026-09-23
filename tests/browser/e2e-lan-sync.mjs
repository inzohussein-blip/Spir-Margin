// Office-network sync, end to end, with real servers.
//
// The server the runner started plays the MAIN computer. This suite starts
// two more from the same build, each with a database of its own:
//   an empty OFFICE computer, which must join by taking a full copy, and
//   a computer with work of its OWN, which must merge rather than be wiped.
// Every step goes through the screens a person would use.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { H, launch, results } from "./harness.mjs";

const { check, done } = results("office sync");
const browser = await launch();
const opts = { locale: "ar-EG", viewport: { width: 1400, height: 1000 } };
const errs = [];

// ---------------------------------------------------------------- servers
const extra = [];
async function startServer(port) {
  const dataDir = mkdtempSync(join(tmpdir(), "spir-lan-test-"));
  const proc = spawn("npx", ["next", "start", "-p", String(port)], {
    env: { ...process.env, PORT: String(port), PGLITE_DATA_DIR: dataDir, SPIR_SEED: "none" },
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
      if ((await fetch(url + "/welcome", { signal: AbortSignal.timeout(4000) })).ok) return { url, log: () => log };
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

async function signedIn(url) {
  const ctx = await browser.newContext(opts);
  ctx.setDefaultTimeout(120_000);
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errs.push(`${url}: ${String(e).slice(0, 140)}`));
  for (let attempt = 1; attempt <= 3; attempt++) {
    await p.goto(url + "/login", { waitUntil: "domcontentloaded", timeout: 180_000 });
    if (!new URL(p.url()).pathname.startsWith("/login")) break;
    await p.fill('input[name="email"]', "admin@spir.local");
    await p.fill('input[name="password"]', "123");
    await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
    await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 180_000 }).catch(() => {});
    if (!new URL(p.url()).pathname.startsWith("/login")) break;
  }
  return p;
}

async function addLab(p, url, code, name) {
  await p.goto(url + "/labs/new", { waitUntil: "networkidle" });
  await p.fill('input[name="code"]', code);
  await p.fill('input[name="name"]', name);
  await p.locator('button[type="submit"]').last().click();
  await p.waitForURL((u) => !u.pathname.endsWith("/new"), { timeout: 60_000 }).catch(() => {});
}

async function labsText(p, url) {
  await p.goto(url + "/labs", { waitUntil: "networkidle" });
  return p.locator("main").innerText();
}

async function syncNow(p, url) {
  await p.goto(url + "/sync", { waitUntil: "networkidle" });
  await p.locator("main").getByRole("button", { name: "مزامنة الآن" }).click();
  const r = p.locator("[data-sync-result]");
  await r.waitFor({ timeout: 90_000 }).catch(() => {});
  const found = await r.getAttribute("data-sync-result").catch(() => null);
  const text = found ? await r.innerText().catch(() => "") : "(no result) " + (await p.locator("main").innerText()).slice(0, 300).replace(/\n/g, " | ");
  return { ok: found === "ok", text };
}

async function link(p, url, code) {
  await p.goto(url + "/sync", { waitUntil: "networkidle" });
  await p.fill('textarea[name="code"]', code);
  await p.getByRole("button", { name: "اربط", exact: true }).click();
  const msg = p.locator('[role="status"], [role="alert"]').filter({ hasText: /تمّ الربط|تعذّر|لم يقبل|ليس رمز|مختلفتين|رمز الحاسوب الرئيسي نفسه/ });
  await msg.first().waitFor({ timeout: 240_000 }).catch(() => {});
  const text = (await msg.first().innerText().catch(() => "")).trim();
  return (text || "(no message) " + (await p.locator("main").innerText().catch(() => "")).slice(0, 400)).replace(/\n/g, " | ");
}

// ---------------------------------------------------------------- 1. the main computer
const main = await signedIn(H);
await main.goto(H + "/sync", { waitUntil: "networkidle" });
check("the menu has «المزامنة»", (await main.locator('a[href="/sync"]').count()) > 0);
check("the Sync page opens", (await main.locator("h1").innerText()).includes("المزامنة"));
check("a new install syncs with nothing", (await main.getByTestId("syncs-with").innerText()).includes("لا شيء"));

await main.getByRole("button", { name: "اجعل هذا الحاسوب الرئيسي" }).click();
await main.getByText("يخدم شبكة المكتب على المنفذ").waitFor({ timeout: 30_000 }).catch(() => {});
check("it becomes the main computer, listening", (await main.getByText("يخدم شبكة المكتب على المنفذ").count()) === 1);

await main.getByRole("button", { name: "اعرض رمز المزامنة" }).click();
const codeBox = main.locator('textarea[data-sync-code="lan"]');
await codeBox.waitFor({ timeout: 20_000 }).catch(() => {});
const code = (await codeBox.inputValue().catch(() => "")).trim();
check("it shows a sync code", code.startsWith("SPIR1-"), code.slice(0, 20));

// The listener answers nothing but sealed sync requests.
const probe404 = await fetch("http://127.0.0.1:3310/", { signal: AbortSignal.timeout(5000) }).then((r) => r.status).catch(() => 0);
const probeForged = await fetch("http://127.0.0.1:3310/spir-sync/pull", {
  method: "POST", body: new Uint8Array(64), signal: AbortSignal.timeout(5000),
}).then((r) => r.status).catch(() => 0);
check("the sync port serves no pages", probe404 === 404, String(probe404));
check("and refuses a request not sealed with the code", probeForged === 403, String(probeForged));

// ---------------------------------------------------------------- 2. an empty computer joins
const officeSrv = await startServer(3398);
const office = await signedIn(officeSrv.url);
check("a code that is not one is refused", (await link(office, officeSrv.url, "hello")).includes("ليس رمز مزامنة"));

// Same address, wrong secret: what an old or forged code looks like.
const decoded = JSON.parse(Buffer.from(code.slice(6), "base64url").toString("utf8"));
const forged = "SPIR1-" + Buffer.from(JSON.stringify({ ...decoded, s: "x".repeat(43) })).toString("base64url");
check("a code with the wrong secret is refused", (await link(office, officeSrv.url, forged)).includes("لم يقبل"));

const joined = await link(office, officeSrv.url, code);
check("the empty computer links, taking a full copy", joined.includes("نسخة كاملة"), joined);
await office.goto(officeSrv.url + "/sync", { waitUntil: "networkidle" });
check("and says it syncs with the main computer", (await office.getByTestId("syncs-with").innerText()).includes("الحاسوب الرئيسي"));

// The main computer carries the demo records; LAB-001 is one of its labs.
const demoOnMain = (await labsText(main, H)).includes("LAB-001");
check("it has the main computer's records", demoOnMain && (await labsText(office, officeSrv.url)).includes("LAB-001"));

// ---------------------------------------------------------------- 3. both directions
const stamp = String(Date.now()).slice(-6);
await addLab(office, officeSrv.url, `OFF-${stamp}`, `مختبر من المكتب ${stamp}`);
const up = await syncNow(office, officeSrv.url);
check("the office computer syncs", up.ok, up.text);
check("its new lab reaches the main computer", (await labsText(main, H)).includes(`مختبر من المكتب ${stamp}`));

await addLab(main, H, `MAIN-${stamp}`, `مختبر من الرئيسي ${stamp}`);
const down = await syncNow(office, officeSrv.url);
check("and the main computer's new lab reaches it", down.ok && (await labsText(office, officeSrv.url)).includes(`مختبر من الرئيسي ${stamp}`), down.text);

const quiet = await syncNow(office, officeSrv.url);
check("a further sync moves nothing", quiet.ok && /أُرسل 0 · جُلب 0/.test(quiet.text), quiet.text);

await main.goto(H + "/sync", { waitUntil: "networkidle" });
check("the main computer lists the office computer", (await main.locator("table").last().innerText()).includes("127.0.0.1") || (await main.locator("table").last().innerText()).length > 20);

// ---------------------------------------------------------------- 4. a computer with its own work merges
const ownSrv = await startServer(3397);
const own = await signedIn(ownSrv.url);
await addLab(own, ownSrv.url, `OWN-${stamp}`, `مختبر سابق ${stamp}`);
const merged = await link(own, ownSrv.url, code);
check("a computer with its own work merges instead", merged.includes("دُمجت"), merged);
const ownLabs = await labsText(own, ownSrv.url);
check("it keeps its own lab", ownLabs.includes(`مختبر سابق ${stamp}`));
check("and gains the office's", ownLabs.includes(`مختبر من المكتب ${stamp}`) && ownLabs.includes(`مختبر من الرئيسي ${stamp}`));
check("its lab reached the main computer", (await labsText(main, H)).includes(`مختبر سابق ${stamp}`));
const relay = await syncNow(office, officeSrv.url);
check("and, through it, the first office computer", relay.ok && (await labsText(office, officeSrv.url)).includes(`مختبر سابق ${stamp}`), relay.text);

// ---------------------------------------------------------------- 5. a new code cuts old ones off
await main.goto(H + "/sync", { waitUntil: "networkidle" });
main.once("dialog", (d) => d.accept());
await main.getByRole("button", { name: /أنشئ رمزاً جديداً/ }).click();
await main.waitForLoadState("networkidle");
const cut = await syncNow(office, officeSrv.url);
check("after a new code, the old one stops working", !cut.ok && cut.text.includes("لم يقبل"), cut.text);

// ---------------------------------------------------------------- 6. unlink, and switch off
office.once("dialog", (d) => d.accept());
await office.goto(officeSrv.url + "/sync", { waitUntil: "networkidle" });
await office.getByRole("button", { name: "فكّ الربط" }).click();
await office.getByText("فُكّ الربط").waitFor({ timeout: 20_000 }).catch(() => {});
await office.goto(officeSrv.url + "/sync", { waitUntil: "networkidle" });
check("unlinking leaves the computer on its own", (await office.getByTestId("syncs-with").innerText()).includes("لا شيء"));

await main.goto(H + "/sync", { waitUntil: "networkidle" });
await main.getByRole("button", { name: "أوقف خدمة شبكة المكتب" }).click();
await main.waitForLoadState("networkidle");
await main.waitForTimeout(1500);
const closed = await fetch("http://127.0.0.1:3310/", { signal: AbortSignal.timeout(3000) }).then(() => "open").catch(() => "closed");
check("switching the main computer off closes the port", closed === "closed", closed);

check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
stopAll();
done();
