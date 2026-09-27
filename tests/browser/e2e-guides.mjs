// Guides & training (migration 0120): three guides, a new version on edit,
// a trainee, a quiz taken and saved.
import { H, launch, signIn, results } from "./harness.mjs";

const { check, done } = results("guides & training");
const browser = await launch();
const ctx = await browser.newContext({ locale: "ar-EG", viewport: { width: 1400, height: 1000 } });
ctx.setDefaultTimeout(90_000);
const p = await signIn(ctx);
const errs = [];
p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
const settle = () => p.waitForLoadState("networkidle").catch(() => {});

const GUIDES = [
  ["دليل جهاز الطرد", "فصل مكونات العينة", "افتح الغطاء\n! لا تفتح الغطاء أثناء الدوران\nضع الأنابيب متقابلة\nاضبط السرعة", "اهتزاز | عدم توازن | وازن الأنابيب"],
  ["دليل محلل الكيمياء", "قياس المكونات الكيميائية", "شغّل المعايرة\nحمّل الكواشف\nضع العينات\nابدأ التشغيل", "خطأ معايرة | كاشف منتهي | بدّل الكاشف"],
  ["دليل ثلاجة الكواشف", "حفظ الكواشف باردة", "راقب الحرارة\nرتّب حسب الصلاحية\nسجّل القراءة", "حرارة عالية | باب مفتوح | أغلق الباب"],
  ["دليل جهاز الدم", "عدّ خلايا الدم", "شغّل التنظيف\nافحص الكنترول\nقس العينات", "انسداد | تجلط | نظّف المسار"],
];
for (const [title, purpose, steps, troubles] of GUIDES) {
  await p.goto(H + "/guides/new", { waitUntil: "networkidle" });
  await p.fill('input[name="title"]', title);
  await p.fill('input[name="purpose"]', purpose);
  await p.fill('textarea[name="steps"]', steps);
  await p.fill('textarea[name="troubles"]', troubles);
  await p.locator('form:has([name="steps"]) button[type="submit"]').click();
  await p.waitForURL(/\/guides\/[0-9a-f-]{36}/, { timeout: 60_000 }).catch(() => {});
  await p.getByTestId("guide").waitFor({ timeout: 30_000 }).catch(() => {});
  await settle();
}
check("a guide shows its steps, the warning marked", (await p.locator('[data-testid="steps"] li').count()) === 3);
await p.goto(H + "/guides", { waitUntil: "networkidle" });
const first = p.locator(`[data-guide="${GUIDES[0][0]}"]`);
check("the guides are listed", (await p.getByTestId("guide-list").locator("[data-guide]").count()) >= 4);
await first.click();
await p.waitForURL(/\/guides\/[0-9a-f-]{36}$/, { timeout: 30_000 }).catch(() => {});
await settle();
// The address changes before the new page is on screen: wait for the guide itself.
await p.getByTestId("troubles").waitFor({ timeout: 30_000 }).catch(() => {});
check("the warning step stands out", (await p.locator('[data-warn="1"]').count()) === 1, `${await p.locator('[data-warn="1"]').count()} ${p.url()} ${(await p.getByTestId("steps").innerText().catch(() => "")).slice(0, 200)}`);
check("troubleshooting is a table", (await p.getByTestId("troubles").innerText().catch(() => "")).includes("وازن الأنابيب"));
const url = p.url();
await p.goto(url + "/edit", { waitUntil: "networkidle" });
await p.fill('textarea[name="steps"]', `${GUIDES[0][2]}\nأطفئ الجهاز`);
await p.locator('form:has([name="steps"]) button[type="submit"]').click();
await p.waitForURL((u) => !u.pathname.endsWith("/edit"), { timeout: 60_000 }).catch(() => {});
await settle();
check("an edit makes version 2", /2/.test(await p.getByTestId("doc-control").innerText().catch(() => "")));

// A trainee and a quiz.
await p.goto(H + "/guides/trainees", { waitUntil: "networkidle" });
await p.fill('input[name="full_name"]', "متدرّب الاختبار");
await p.locator('form:has([name="full_name"]) button[type="submit"]').click();
await p.getByTestId("trainee-table").waitFor({ timeout: 30_000 }).catch(() => {});
check("the trainee is added", (await p.getByTestId("trainee-table").innerText().catch(() => "")).includes("متدرّب الاختبار"));

await p.goto(H + "/guides/quiz?n=5&seed=7", { waitUntil: "networkidle" });
const quiz = p.getByTestId("quiz");
check("a quiz is made from the guides", (await quiz.count()) === 1);
await quiz.locator('select[name="trainee"]').selectOption({ label: "متدرّب الاختبار" });
for (let i = 0; i < 5; i++) {
  await quiz.locator('[data-option="0"]').click();
  if (i < 4) await quiz.getByRole("button", { name: "التالي" }).click();
}
await p.getByTestId("finish").click();
await p.getByTestId("quiz-result").waitFor({ timeout: 30_000 }).catch(() => {});
check("the score is shown", /\d+\/5/.test((await p.locator("[data-score]").getAttribute("data-score").catch(() => "")) ?? ""));
await p.waitForTimeout(1500);
await p.goto(H + "/guides/trainees", { waitUntil: "networkidle" });
const row = p.locator('tr[data-trainee="متدرّب الاختبار"]');
check("and saved with the trainee", (await row.locator("td").nth(1).innerText().catch(() => "")).trim() === "1");
check("no Arabic-Indic digits", !/[٠-٩]/.test(await p.locator("body").innerText()));
check("no uncaught page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await browser.close();
done();
