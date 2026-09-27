// Guides & training (migration 0120, src/lib/guides/core.ts): reading the
// guide form, quizzes made from the guides, and the database: a change to
// what a guide says makes it a new version.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, importTs } from "./helpers.mjs";

const g = await importTs("src/lib/guides/core.ts");

test("the guide form: steps with warnings, tips, troubleshooting", () => {
  assert.deepEqual(g.parseSteps("شغّل الجهاز\n! لا تفتح الغطاء أثناء الدوران\n\n  نظّف  "), [
    { text: "شغّل الجهاز", warn: false }, { text: "لا تفتح الغطاء أثناء الدوران", warn: true }, { text: "نظّف", warn: false },
  ]);
  assert.equal(g.stepsText(g.parseSteps("أ\n!ب")), "أ\n! ب");
  assert.deepEqual(g.parseTroubles("لا يعمل | القابس | أعد توصيله\nسطر ناقص"), [{ problem: "لا يعمل", cause: "القابس", fix: "أعد توصيله" }]);
});

const guide = (id, title, purpose, steps, troubles = []) => ({
  id, title, category: "device", purpose, steps: steps.map((text) => ({ text, warn: false })), tips: [], troubles,
});
const GUIDES = [
  guide("a", "جهاز الطرد", "فصل مكونات العينة", ["افتح الغطاء", "ضع الأنابيب متقابلة", "أغلق الغطاء", "اضبط السرعة"], [{ problem: "اهتزاز", cause: "عدم توازن", fix: "وازن الأنابيب" }]),
  guide("b", "محلل الكيمياء", "قياس المكونات الكيميائية", ["شغّل المعايرة", "حمّل الكواشف", "ضع العينات", "ابدأ التشغيل"], [{ problem: "خطأ معايرة", cause: "كاشف منتهي", fix: "بدّل الكاشف" }]),
  guide("c", "ثلاجة الكواشف", "حفظ الكواشف باردة", ["راقب الحرارة", "رتّب حسب الصلاحية", "سجّل القراءة"], [{ problem: "حرارة عالية", cause: "باب مفتوح", fix: "أغلق الباب" }]),
  guide("d", "جهاز الدم", "عدّ خلايا الدم", ["شغّل التنظيف", "افحص الكنترول", "قس العينات"], [{ problem: "انسداد", cause: "تجلط", fix: "نظّف المسار" }]),
];

test("a quiz: four options, one right, drawn from the other guides; the same seed gives the same quiz", () => {
  const q = g.buildQuiz(GUIDES, 12, 42);
  assert.equal(q.length, 12);
  for (const x of q) {
    assert.equal(x.options.length, 4);
    assert.equal(new Set(x.options).size, 4, "distinct options");
    assert.ok(x.answer >= 0 && x.answer < 4);
  }
  const purpose = q.find((x) => x.kind === "purpose");
  assert.ok(purpose && GUIDES.some((y) => y.title === purpose.subject && y.purpose === purpose.options[purpose.answer]));
  assert.deepEqual(g.buildQuiz(GUIDES, 12, 42).map((x) => x.id), q.map((x) => x.id));
  assert.equal(g.buildQuiz(GUIDES.slice(0, 1), 10, 1).length, 0, "one guide cannot make fair wrong answers");
  const s = g.score(q, q.map((x, i) => (i < 3 ? x.answer : (x.answer + 1) % 4)));
  assert.deepEqual([s.right, s.total], [3, 12]);
});

test("the database: a change to what a guide says makes a new version", async () => {
  const db = await bootWithMigrations();
  try {
    const id = (await db.query(`insert into kb_guides (title, steps) values ('دليل', '[{"text":"خطوة","warn":false}]') returning id`)).rows[0].id;
    await db.query(`update kb_guides set reviewed_by = 'م. علي' where id = $1`, [id]);
    assert.equal((await db.query(`select version from kb_guides where id = $1`, [id])).rows[0].version, 1, "who reviewed it is not a new version");
    await db.query(`update kb_guides set steps = '[{"text":"خطوة معدّلة","warn":true}]' where id = $1`, [id]);
    assert.equal((await db.query(`select version from kb_guides where id = $1`, [id])).rows[0].version, 2);
    const t = (await db.query(`insert into kb_trainees (full_name) values ('متدرّب') returning id`)).rows[0].id;
    await db.query(`insert into kb_results (trainee_id, score, total) values ($1, 8, 10)`, [t]);
    await assert.rejects(db.query(`insert into kb_results (trainee_id, score, total) values ($1, 11, 10)`, [t]));
  } finally {
    await db.close();
  }
});
