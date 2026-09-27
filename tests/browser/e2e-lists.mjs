// Long lists show one page at a time and search the whole table on the
// server: a lab is found by its city even spelled with ه for ة, a search
// that matches nothing says so, and a page past the end is simply empty.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("lists: search & pages");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 950 } });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
const table = () => p.locator("[data-desk-list] tbody tr");

await p.goto(H + "/labs", { waitUntil: "networkidle" });
check("the list has a search box that searches the whole table", (await p.locator("form[data-list-search] input[name=q]").count()) === 1);
const all = await table().count();
await p.locator("form[data-list-search] input[name=q]").fill("البصره");
await p.locator("form[data-list-search] button").click();
await p.waitForURL(/q=/);
await p.waitForLoadState("networkidle");
const found = await table().count();
check("a lab is found by its city, ة written as ه", found === 1 && (await table().first().innerText()).includes("LAB-002"), `${found} of ${all}`);
check("the count says how many match", (await p.locator("h1 + span").first().innerText().catch(() => "")).trim() === "1");

await p.goto(H + "/labs?q=" + encodeURIComponent("لا يوجد مختبر بهذا الاسم"), { waitUntil: "networkidle" });
check("a search that matches nothing shows no rows", (await table().count()) === 0);
await p.goto(H + "/labs?page=99", { waitUntil: "networkidle" });
check("a page past the end is empty, not an error", (await table().count()) === 0 && !(await p.locator("body").innerText()).includes("حدث خطأ"));

for (const path of ["/products", "/companies", "/appointments", "/issues", "/maintenance-visits", "/stock-entries", "/kits", "/audit-log", "/sale-requests", "/authorizations"]) {
  const res = await p.goto(H + path + "?q=x&page=1", { waitUntil: "networkidle" });
  check(`${path} answers with a search`, (res?.status() ?? 0) === 200 && !(await p.locator("body").innerText()).includes("حدث خطأ"));
}

await p.goto(H + "/station/all", { waitUntil: "networkidle" });
check("the dashboard still shows its figures", (await p.locator("body").innerText()).includes("المختبرات النشطة"));
check("no Arabic-Indic digits", !/[٠-٩]/.test(await p.locator("body").innerText()));
check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
