// Barcode labels and the document check page: pick a product, print its
// Code 128 label; a QR that does not belong to any company is refused.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("labels & verify");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 1000 } });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));

await p.goto(H + "/labels", { waitUntil: "networkidle" });
check("the menu has barcode labels", (await p.locator('a[href="/labels"]').count()) > 0);
const picker = p.getByTestId("label-picker");
const boxes = picker.locator('input[name="id"]');
check("products are offered", (await boxes.count()) > 0);
await boxes.first().check();
await picker.locator('input[name="copies"]').fill("2");
await picker.getByRole("button", { name: "تجهيز الملصقات" }).click();
await p.getByTestId("label-sheet").waitFor({ timeout: 30_000 }).catch(() => {});
const labels = p.locator("[data-label]");
check("two copies of the label", (await labels.count()) === 2);
check("each with a barcode", (await labels.first().locator("svg rect").count()) > 20);
check("and its code under it", /\S/.test((await labels.first().getAttribute("data-label")) ?? ""));

const v = await (await browser.newContext({ locale: "ar-EG" })).newPage();
await v.goto(H + "/verify/not-a-real-token", { waitUntil: "networkidle" });
check("the check page opens without signing in", new URL(v.url()).pathname.startsWith("/verify/"), v.url());
check("and refuses a QR that is not a company's", (await v.getByTestId("verify").getAttribute("data-state")) === "invalid");
check("no Arabic-Indic digits", !/[٠-٩]/.test(await p.locator("body").innerText()));
check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
