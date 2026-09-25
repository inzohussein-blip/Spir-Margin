// Arabic-aware search, in the browser (src/lib/text/arabic.ts) and in the
// database (fn_ar_norm, migration 0114) — the two must agree — and which kit
// batch a sale takes next (src/lib/kits.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, importTs } from "./helpers.mjs";

const { foldArabic, arabicIncludes } = await importTs("src/lib/text/arabic.ts");
const { nextBatches, SOON_DAYS } = await importTs("src/lib/kits.ts");

const SAME = [
  ["أحمد", "احمد"], ["إبراهيم", "ابراهيم"], ["آمنة", "امنه"], ["مكتبة", "مكتبه"],
  ["الكندي", "الكندى"], ["مُختَبَر", "مختبر"], ["مخـــتبر", "مختبر"], ["مسؤول", "مسوول"],
  ["LAB-١٢٣", "lab-123"], ["جهاز ۴۵", "جهاز 45"],
];

test("spelling variants fold to the same text", () => {
  for (const [a, b] of SAME) assert.equal(foldArabic(a), foldArabic(b), `${a} ~ ${b}`);
  assert.ok(arabicIncludes("مختبر الكندي التعليمي", "الكندى"));
  assert.ok(arabicIncludes("Al-Kindy Lab", "kindy"));
  assert.ok(!arabicIncludes("مختبر بغداد", "البصرة"));
});

test("the database folds exactly as the browser does, and searches with it", async () => {
  const db = await bootWithMigrations();
  try {
    for (const [a, b] of SAME) {
      const r = (await db.query(`select fn_ar_norm($1) as x, fn_ar_norm($2) as y`, [a, b])).rows[0];
      assert.equal(r.x, r.y, `${a} ~ ${b} in the database`);
      assert.equal(r.x, foldArabic(a), `${a}: database and browser agree`);
    }
    await db.query(`insert into labs (code, name) values ('LAB-AR1', 'مختبر أحمد الكندي')`);
    const found = await db.query(`select label from fn_global_search('احمد الكندى', 8) where entity = 'lab'`);
    assert.deepEqual(found.rows.map((r) => r.label), ["مختبر أحمد الكندي"]);
  } finally {
    await db.close();
  }
});

test("a sale takes the earliest-expiring kit batch, and says how close it is", () => {
  const today = "2026-09-25";
  const rows = [
    { product_id: "k1", batch_no: "B-LATE", expiry_date: "2027-06-01", qty_available: 10, created_at: "2026-01-01" },
    { product_id: "k1", batch_no: "B-SOON", expiry_date: "2026-10-10", qty_available: 3, created_at: "2026-02-01" },
    { product_id: "k1", batch_no: "B-EMPTY", expiry_date: "2026-09-30", qty_available: 0, created_at: "2026-01-01" },
    { product_id: "k2", batch_no: "B-OLD", expiry_date: "2026-09-20", qty_available: 2, created_at: "2026-01-01" },
    { product_id: "k3", batch_no: "B-NODATE", expiry_date: null, qty_available: 5, created_at: "2026-01-01" },
    { product_id: "k3", batch_no: "B-FAR", expiry_date: "2028-01-01", qty_available: 5, created_at: "2026-03-01" },
  ];
  const h = nextBatches(rows, today);
  assert.equal(h.k1.batchNo, "B-SOON", "an empty batch is skipped");
  assert.equal(h.k1.days, 15);
  assert.equal(h.k1.level, "soon");
  assert.equal(h.k2.level, "expired");
  assert.equal(h.k2.days, -5);
  assert.equal(h.k3.batchNo, "B-FAR", "a dated batch goes before an undated one");
  assert.equal(h.k3.level, "ok");
  assert.equal(nextBatches([{ ...rows[0], expiry_date: "2026-10-25" }], today).k1.level, SOON_DAYS === 30 ? "soon" : "ok");
});
