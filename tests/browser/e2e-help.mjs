// Instructions (تعليمات), under Setup.
//
// Instructions that point at a page that does not exist, or name a menu the
// way the menu does not, are worse than none. So every tab is opened, every
// link in them is followed, and the labels they quote are checked against the
// screens they describe.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("instructions");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 1000 } });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

const TABS = [
  ["features", "الخواص"],
  ["start", "البدء السريع"],
  ["install", "التثبيت على ويندوز"],
  ["settings", "الإعدادات"],
  ["offline", "العمل دون إنترنت والمزامنة"],
  ["backup", "النسخ الاحتياطي"],
  ["users", "المستخدمون والأمان"],
  ["troubleshooting", "حلّ المشكلات"],
];

// 1. It is in the menu, under Setup.
await p.goto(H + "/settings", { waitUntil: "networkidle" });
const navLink = p.locator('aside a[href="/help"], nav a[href="/help"]').first();
check("the menu has an Instructions entry", (await navLink.count()) > 0);
check("it is called «تعليمات»", ((await navLink.innerText().catch(() => "")) || "").includes("تعليمات"));

// 2. Settings points at its own instructions.
const fromSettings = p.locator('a[href="/help?tab=settings"]').first();
check("Settings links to its instructions", (await fromSettings.count()) > 0);
await fromSettings.click();
await p.waitForURL(/\/help\?tab=settings/);
check("and lands on the settings tab",
  (await p.locator('nav a[aria-current="page"]').innerText()).includes("الإعدادات"));

// 3. Every tab opens, says what it is, and has something to say.
const links = new Set();
for (const [id, title] of TABS) {
  await p.goto(`${H}/help?tab=${id}`, { waitUntil: "networkidle" });
  const current = (await p.locator('nav a[aria-current="page"]').innerText().catch(() => "")).trim();
  const body = await p.locator("main").innerText().catch(async () => p.locator("body").innerText());
  check(`the «${title}» tab opens`, current.includes(title), current);
  check(`it has real content`, body.length > 400, `${body.length} chars`);
  check(`it uses 1234 digits`, !/[٠-٩]/.test(body));
  for (const href of await p.locator('main a[href^="/"]').evaluateAll((as) => as.map((a) => a.getAttribute("href")))) {
    if (href && !href.startsWith("/help")) links.add(href);
  }
}
const features = await (async () => {
  await p.goto(`${H}/help?tab=features`, { waitUntil: "networkidle" });
  return p.locator("main section").count();
})();
check("the features tab covers every menu group", features >= 16, `${features} sections`);

// 4. Every place the instructions send you to exists.
const broken = [];
for (const href of links) {
  const res = await p.request.get(H + href, { maxRedirects: 0 }).catch(() => null);
  const status = res ? res.status() : 0;
  if (status === 0 || status >= 400) broken.push(`${href} → ${status}`);
}
check(`all ${links.size} links in the instructions lead somewhere`, broken.length === 0, broken.join(" | "));

// 5. The roles it explains are told apart on screen.
await p.goto(H + "/users", { waitUntil: "networkidle" });
const roles = await p.locator('select[name="role"] option').evaluateAll((os) => os.map((o) => [o.value, o.textContent.trim()]));
const label = Object.fromEntries(roles);
check("the admin role reads «مسؤول»", label.admin === "مسؤول", JSON.stringify(label));
check("and is not the same word as manager", label.admin !== label.manager, JSON.stringify(label));

// 6. The role beside the name is Arabic too.
const header = await p.locator("header").first().innerText().catch(() => "");
check("the header does not show «ADMIN»", !/ADMIN/.test(header));
check("it shows the role in Arabic", header.includes("مسؤول"));

check("no uncaught page errors", errs.length === 0, errs.join(" | "));
await browser.close();
done();
