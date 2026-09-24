// Updates (Settings → Updates): what this copy is, asking for the newest
// release, the bell telling an administrator, and what happens offline.
//
// The runner points the server at a stand-in for GitHub's releases API on
// :3396 (SPIR_UPDATE_API); this suite runs it. The test server is not a
// Windows install, so it offers the steps rather than an "Update now" button —
// the Windows updater itself is covered by tests/windows-updater.test.mjs.
import { createServer } from "node:http";
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("updates");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1300, height: 1100 } });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
const panel = () => p.locator("#updates");

// ---------------------------------------------------------------- the stand-in
let latest = 9; // null: no release published yet
const gh = createServer((req, res) => {
  if (req.url === "/repos/acme/spir/releases/latest" && latest) {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({
      tag_name: `build-${latest}`, draft: false, prerelease: false, published_at: "2026-09-24T08:00:00Z",
      assets: [{ name: "spir-margin.zip", browser_download_url: "http://127.0.0.1:3396/spir-margin.zip" }],
    }));
    return;
  }
  res.statusCode = 404;
  res.end('{"message":"Not Found"}');
});
await new Promise((r) => gh.listen(3396, "127.0.0.1", r));

async function checkNow() {
  await p.goto(H + "/settings#updates", { waitUntil: "networkidle" });
  for (let attempt = 0; attempt < 3; attempt++) {
    await panel().getByRole("button", { name: "تحقّق الآن" }).click();
    if (await p.waitForURL(/update=checked/, { timeout: 20_000 }).then(() => true).catch(() => false)) break;
  }
  await p.waitForLoadState("networkidle");
  return panel().innerText();
}

// ---------------------------------------------------------------- 1. what this copy is
await p.goto(H + "/settings", { waitUntil: "networkidle" });
check("Settings has the updates panel", (await panel().count()) === 1);
const current = await panel().getByTestId("current-release").innerText().catch(() => "");
check("it says which release this copy is", current.includes("هذا الحاسوب"), current);

// ---------------------------------------------------------------- 2. a new release
let text = await checkNow();
check("asking finds the new release", (await panel().getByTestId("update-available").count()) === 1 && text.includes("الإصدار 9"), text.slice(0, 300));
check("with the date it was published", text.includes("2026-09-24"));
check("and when it last asked", text.includes("آخر تحقّق"));
check("a computer that cannot update itself shows the steps instead", text.includes("الخطوات في التعليمات") && (await panel().getByRole("button", { name: "حدّث الآن" }).count()) === 0);

await p.goto(H + "/", { waitUntil: "networkidle" });
await p.locator('header button[title="الإشعارات"]').first().click().catch(() => {});
await p.waitForTimeout(500);
const bell = await p.locator("body").innerText();
check("the bell tells the administrator", bell.includes("يتوفّر إصدار جديد"), bell.slice(0, 200));

// ---------------------------------------------------------------- 3. offline
gh.close();
text = await checkNow();
check("offline, it says so and the program carries on", text.includes("تعذّر الوصول إلى خادم التحديثات"), text.slice(0, 300));

// ---------------------------------------------------------------- 4. nothing newer
latest = null;
await new Promise((r) => gh.listen(3396, "127.0.0.1", r));
text = await checkNow();
check("with nothing newer published, it is the newest", (await panel().getByTestId("up-to-date").count()) === 1, text.slice(0, 300));

// The status route is for administrators only.
const anon = await (await browser.newContext()).request.get(H + "/api/update/status", { maxRedirects: 0 });
check("the progress route refuses anyone signed out", anon.status() !== 200, String(anon.status()));

check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
gh.close();
await browser.close();
done();
