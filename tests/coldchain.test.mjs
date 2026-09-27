// Cold chain & calibration (migration 0118, src/lib/coldchain/core.ts):
// ranges, a unit's month, today's status, task and calibration due dates,
// and the database: one reading per unit / day / slot, a calibration entry
// moving the instrument's date forward.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, importTs } from "./helpers.mjs";

const cc = await importTs("src/lib/coldchain/core.ts");
const FRIDGE = { id: "u1", name: "ثلاجة", kind: "fridge", min_temp: 2, max_temp: 8, is_active: true };
const r = (reading_date, slot, value, action = null) => ({ unit_id: "u1", reading_date, slot, value, action });

test("the safe range, and a unit's month", () => {
  assert.equal(cc.inRange(FRIDGE, 2), true);
  assert.equal(cc.inRange(FRIDGE, 8.5), false);
  const m = cc.unitMonth(FRIDGE, [r("2026-09-01", "AM", 4), r("2026-09-01", "PM", 9.5), r("2026-09-02", "AM", 1)], "2026-09", "2026-09-03");
  assert.equal(m.rows.length, 30);
  assert.deepEqual([m.out, m.missing, m.min, m.max], [2, 1, 1, 9.5], "day 2 PM is missing; today and later are not");
});

test("today: readings still to take, and alarms with no action", () => {
  const units = [FRIDGE, { ...FRIDGE, id: "u2", name: "فريزر" }, { ...FRIDGE, id: "u3", is_active: false }];
  const s = cc.todayStatus(units, [r("2026-09-27", "AM", 12), { ...r("2026-09-27", "AM", 3), unit_id: "u2" }], "2026-09-27", "AM");
  assert.equal(s.due.length, 0);
  assert.equal(s.alarms.length, 1);
  assert.equal(cc.todayStatus(units, [r("2026-09-27", "AM", 12, "نُقلت الكواشف")], "2026-09-27", "AM").alarms.length, 0, "an action written clears the alarm");
});

test("routine tasks and calibration", () => {
  assert.deepEqual(cc.taskDue("weekly", "2026-09-20", "2026-09-27"), { next: "2026-09-27", due: true, overdueDays: 0 });
  assert.equal(cc.taskDue("monthly", "2026-09-20", "2026-09-27").due, false);
  assert.equal(cc.taskDue("daily", null, "2026-09-27").due, true, "never done: due now");
  assert.deepEqual(cc.calibrationDue("2026-03-31", 6, "2026-09-27"), { next: "2026-09-30", daysLeft: 3 });
  assert.equal(cc.calibrationDue("2025-01-15", 12, "2026-09-27").daysLeft < 0, true);
  assert.equal(cc.calibrationDue("2026-01-01", null, "2026-09-27"), null);
});

test("the database: one reading per unit, day and slot; calibration moves the date", async () => {
  const db = await bootWithMigrations();
  try {
    const u = (await db.query(`insert into cc_storage_units (name, min_temp, max_temp) values ('ثلاجة 1', 2, 8) returning id`)).rows[0].id;
    await db.query(`select fn_cc_set_reading($1, '2026-09-27', 'AM', 4.5, 'أحمد', null)`, [u]);
    await db.query(`select fn_cc_set_reading($1, '2026-09-27', 'AM', 9, 'أحمد', 'أُغلق الباب')`, [u]);
    let rows = (await db.query(`select value::float as v, action from cc_readings where unit_id = $1`, [u])).rows;
    assert.deepEqual(rows, [{ v: 9, action: "أُغلق الباب" }]);
    await assert.rejects(db.query(`select fn_cc_set_reading($1, '2026-09-27', 'XX', 4, null, null)`, [u]), /صباحاً/);
    await assert.rejects(db.query(`select fn_cc_set_reading($1, '2026-09-27', 'PM', 400, null, null)`, [u]), /غير معقولة/);
    await db.query(`select fn_cc_set_reading($1, '2026-09-27', 'AM', null, null, null)`, [u]);
    assert.equal((await db.query(`select count(*)::int as n from cc_readings`)).rows[0].n, 0);
    await assert.rejects(db.query(`insert into cc_storage_units (name, min_temp, max_temp) values ('خطأ', 8, 2)`));

    const e = (await db.query(`insert into cc_equipment (name, calib_months, last_calibrated) values ('محرار', 6, '2026-01-10') returning id`)).rows[0].id;
    await db.query(`insert into cc_equipment_log (equipment_id, log_date, log_type, details) values ($1, '2026-09-20', 'calibration', 'معايرة سنوية')`, [e]);
    rows = (await db.query(`select last_calibrated::text as d from cc_equipment where id = $1`, [e])).rows;
    assert.equal(rows[0].d, "2026-09-20");
    await db.query(`insert into cc_equipment_log (equipment_id, log_date, log_type, details) values ($1, '2026-05-01', 'calibration', 'قديمة')`, [e]);
    assert.equal((await db.query(`select last_calibrated::text as d from cc_equipment where id = $1`, [e])).rows[0].d, "2026-09-20", "an older entry does not move it back");
  } finally {
    await db.close();
  }
});
