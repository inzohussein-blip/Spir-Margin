// Working without internet, and without the program.
//
// The app's server runs on the same computer as the browser, so "no internet"
// must change nothing: a sale goes straight into this computer's database.
// It used to follow navigator.onLine instead, which parked every sale made
// without a network in the browser's storage — out of the stock, the reports
// and the backups — until the network came back.
//
// The one real outage is the program itself not answering. Then the app must
// say so in Arabic and recover by itself, not show the browser's error page.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("offline");
const browser = await launch();
const OUTBOX = "spir_outbox_v1";
const outboxSize = (page) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "[]").length, OUTBOX);

async function ringUpOneSale(page) {
  await page.goto(H + "/pos", { waitUntil: "networkidle" });
  const lab = await page.locator("select option").nth(1).getAttribute("value");
  await page.locator("select").first().selectOption(lab);
  // the first product tile in the grid
  await page.locator("main button:has(p), aside ~ * button:has(p), [class*='grid'] > button").first().click();
  await page.getByRole("button", { name: "إتمام البيع" }).click();
}

// ── 1. No internet, program running: the sale is booked, not queued ────────
{
  const ctx = await browser.newContext({ locale: "ar-EG" });
  ctx.setDefaultTimeout(90_000);
  // This computer has no network at all.
  await ctx.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { get: () => false, configurable: true });
  });
  const p = await signIn(ctx);
  await ringUpOneSale(p);
  const booked = await p.getByText("تم تسجيل البيع").waitFor({ timeout: 30_000 }).then(() => true, () => false);
  check("with no internet, a sale is booked in the database", booked,
    booked ? "" : (await p.locator("aside").last().innerText()).replace(/\s+/g, " ").slice(0, 300));
  check("and nothing is left waiting in the browser", (await outboxSize(p)) === 0, String(await outboxSize(p)));
  const text = await p.locator("body").innerText();
  check("the screen says sales are saved as usual", text.includes("البيع يُحفظ على هذا الحاسوب كالمعتاد"));
  check("it no longer offers to 'save offline'", !text.includes("حفظ البيع دون اتصال"));
  await ctx.close();
}

// ── 2. The program does not answer: held, then sent by itself ─────────────
{
  const ctx = await browser.newContext({ locale: "ar-EG" });
  ctx.setDefaultTimeout(90_000);
  const p = await signIn(ctx);
  let down = true;
  // The sale is a POST to /pos; refuse it as a stopped program would.
  await p.route("**/pos", (r) => (down && r.request().method() === "POST" ? r.abort() : r.continue()));
  await ringUpOneSale(p);
  const held = await p.getByText("لم يستجب البرنامج").waitFor({ timeout: 30_000 }).then(() => true, () => false);
  check("when the program does not answer, the sale is held", held);
  check("one sale is waiting in the browser", (await outboxSize(p)) === 1, String(await outboxSize(p)));
  down = false;
  // No browser event announces "the program is back" — it must notice alone.
  let left = 1;
  for (let i = 0; i < 45 && left > 0; i++) {
    await p.waitForTimeout(1000);
    left = await outboxSize(p);
  }
  check("once the program answers, the sale is sent without anyone asking", left === 0, `${left} still waiting`);
  await ctx.close();
}

// ── 3. The program is not running at all: an Arabic page that recovers ────
{
  const ctx = await browser.newContext({ locale: "ar-EG" });
  ctx.setDefaultTimeout(90_000);
  const p = await signIn(ctx);
  await p.goto(H + "/labs", { waitUntil: "networkidle" });
  // Wait for the worker to be installed and in control of the page.
  await p.evaluate(() => navigator.serviceWorker.ready);
  await p.reload({ waitUntil: "networkidle" });
  const controlled = await p.evaluate(() => !!navigator.serviceWorker.controller);
  check("the offline helper is installed", controlled);

  let down = true;
  // A stopped program answers nothing. (Filtering on isNavigationRequest() is
  // not enough: once the worker is in control, the request it makes on the
  // page's behalf is not flagged as a navigation.)
  await ctx.route("**/*", (r) => (down ? r.abort("connectionrefused") : r.continue()));
  await p.goto(H + "/labs").catch(() => {});
  const shown = await p.getByText("البرنامج لا يستجيب بعد").waitFor({ timeout: 20_000 }).then(() => true, () => false);
  check("with the program stopped, an Arabic explanation is shown", shown,
    shown ? "" : `${p.url()} :: ${(await p.locator("body").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 200)}`);
  check("it is not the browser's own error page", !(await p.locator("body").innerText()).includes("ERR_"));

  down = false; // the program comes back
  const back = await p
    .waitForFunction(() => !document.body.innerText.includes("البرنامج لا يستجيب بعد"), null, { timeout: 30_000 })
    .then(() => true, () => false);
  check("when the program starts, the page opens the app by itself", back);
  check("and it is the page that was asked for", new URL(p.url()).pathname === "/labs", p.url());
  await ctx.close();
}

await browser.close();
done();
