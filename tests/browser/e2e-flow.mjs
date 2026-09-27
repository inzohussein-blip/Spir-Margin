// The way through the program: opening it starts at the main menu (the
// welcome page); a station shows its own sections only, with the way back;
// «the whole system» is the dashboard with everything. (Without a
// connection: e2e-offline.mjs.)
import { H, ACCOUNT, launch, results } from "./harness.mjs";

const { check, done } = results("main menu & stations");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 950 } });
ctx.setDefaultTimeout(90_000);
const p = await ctx.newPage();
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
const path = () => new URL(p.url()).pathname;

// 1. Signed out: the program opens on the welcome page.
await p.goto(H + "/", { waitUntil: "networkidle", timeout: 180_000 });
check("opening the program shows the welcome page", path() === "/welcome", p.url());

// 2. In through a station: signed in, it opens that station's home.
await p.locator('[data-station="sales"]').click();
await p.waitForURL(/\/login/);
await p.fill('input[name="email"]', ACCOUNT.email);
await p.fill('input[name="password"]', ACCOUNT.password);
await p.locator('form:has(input[name="password"]) button[type="submit"]').first().click();
await p.waitForURL(/\/station\/sales/, { timeout: 120_000 }).catch(() => {});
await p.getByTestId("station-home").waitFor({ timeout: 30_000 }).catch(() => {});
check("a station opens its own home after signing in", path() === "/station/sales", p.url());
const side = p.locator("aside");
await side.getByTestId("station-nav").waitFor({ timeout: 15_000 }).catch(() => {});
check("its sidebar shows its sections", (await side.locator('a[href="/pos"]').count()) === 1, `${await side.locator('a[href="/pos"]').count()} :: ${(await side.innerText()).replace(/\s+/g, " ").slice(0, 300)}`);
check("and not the other stations'", (await side.locator('a[href="/hr/attendance"]').count()) === 0 && (await side.locator('a[href="/purchase-orders"]').count()) === 0);
check("with the way back to the main menu", (await side.getByTestId("main-menu").count()) === 1);
check("its home lists its pages", (await p.locator('[data-tile="/pos"]').count()) === 1);

// 3. Back to the main menu, signed in: straight into another station.
await side.getByTestId("main-menu").click();
await p.waitForURL(/\/welcome/);
await p.getByTestId("signed-in-as").waitFor({ timeout: 15_000 }).catch(() => {});
check("the main menu says who is signed in", (await p.getByTestId("signed-in-as").count()) === 1);
await p.locator('[data-station="hr"]').click();
await p.waitForURL(/\/station\/hr/);
await p.getByTestId("station-home").waitFor();
await p.locator("aside").getByTestId("station-nav").filter({ hasText: "الكادر" }).waitFor({ timeout: 15_000 }).catch(() => {});
check("another station opens without signing in again", path() === "/station/hr");
check("with its own sections", (await p.locator("aside").locator('a[href="/hr/attendance"]').count()) === 1 && (await p.locator("aside").locator('a[href="/pos"]').count()) === 0,
  (await p.locator("aside").innerText()).replace(/\s+/g, " ").slice(0, 300));

// 4. The whole system: the dashboard, every section.
await p.locator("aside").getByTestId("main-menu").click();
await p.waitForURL(/\/welcome/);
await p.locator('[data-station="all"]').click();
await p.waitForURL(/\/station\/all/);
await p.locator("aside").locator('a[href="/hr/attendance"]').first().waitFor({ timeout: 30_000 }).catch(() => {});
check("the whole system shows every section", (await p.locator("aside").locator('a[href="/w/selling"]').count()) === 1
  && (await p.locator("aside").locator('a[href="/w/hr"]').count()) === 1, (await p.locator("aside").innerText()).replace(/\s+/g, " ").slice(0, 300));
check("and still the way back", (await p.locator("aside").getByTestId("main-menu").count()) === 1);

// 5. Opening the program again, signed in: the main menu, not the dashboard.
await p.goto(H + "/", { waitUntil: "networkidle" });
check("opening the program again starts at the main menu", path() === "/welcome", p.url());

check("no Arabic-Indic digits", !/[٠-٩]/.test(await p.locator("body").innerText()));
check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
