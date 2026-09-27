// Staff & shifts (migration 0117, src/lib/hr/core.ts): how a day is judged,
// the month's summary and payroll, and the database functions that write the
// roster and attendance — one row per person per day, the same on every
// computer.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, importTs } from "./helpers.mjs";

const hr = await importTs("src/lib/hr/core.ts");
const MORNING = { id: "s1", name: "صباحي", start_time: "08:00", end_time: "14:00", color: "#000" };
const NIGHT = { id: "s2", name: "ليلي", start_time: "20:00", end_time: "08:00", color: "#000" };
const ctx = (over = {}) => ({ roster: [], shifts: [MORNING, NIGHT], attendance: [], leaves: [], grace: 10, today: "2026-09-15", ...over });
const cell = (employee_id, work_date, shift_type_id, extra = {}) => ({ employee_id, work_date, shift_type_id, is_off: false, covered_by: null, ...extra });
const att = (employee_id, work_date, check_in, check_out = null) => ({ employee_id, work_date, check_in, check_out });

test("dates: week start, month length, minutes across midnight", () => {
  assert.equal(hr.weekStartOf("2026-09-15", 6), "2026-09-12", "a Saturday-first week");
  assert.equal(hr.weekStartOf("2026-09-12", 6), "2026-09-12");
  assert.equal(hr.weekStartOf("2026-09-15", 0), "2026-09-13", "a Sunday-first week");
  assert.equal(hr.daysInMonth("2026-02"), 28);
  assert.equal(hr.minutesBetween("20:00", "08:00"), 720);
  assert.equal(hr.hoursLabel(125), "2:05");
});

test("a day: on time, late past the grace, absent, still to come, resting, on leave", () => {
  const c = ctx({ roster: [cell("a", "2026-09-14", "s1"), cell("a", "2026-09-15", "s1"), cell("a", "2026-09-13", null, { is_off: true })] });
  assert.equal(hr.dayStatus("a", "2026-09-14", { ...c, attendance: [att("a", "2026-09-14", "08:05", "14:00")] }).status, "present");
  const late = hr.dayStatus("a", "2026-09-14", { ...c, attendance: [att("a", "2026-09-14", "08:25")] });
  assert.deepEqual([late.status, late.lateMin], ["late", 25]);
  assert.equal(hr.dayStatus("a", "2026-09-14", c).status, "absent");
  assert.equal(hr.dayStatus("a", "2026-09-15", c).status, "pending", "today is not absent yet");
  assert.equal(hr.dayStatus("a", "2026-09-13", c).status, "off");
  const leave = { employee_id: "a", leave_type: "sick", from_date: "2026-09-14", to_date: "2026-09-14" };
  assert.equal(hr.dayStatus("a", "2026-09-14", { ...c, leaves: [leave] }).status, "leave");
  const early = hr.dayStatus("a", "2026-09-14", { ...c, attendance: [att("a", "2026-09-14", "07:40")] });
  assert.equal(early.status, "present", "arriving early is not a 23-hour delay");
});

test("covering: the one replaced is not absent, the one covering works the shift", () => {
  const c = ctx({ roster: [cell("a", "2026-09-14", "s2", { covered_by: "b" })], attendance: [att("b", "2026-09-14", "20:00", "08:00")] });
  const a = hr.dayStatus("a", "2026-09-14", c);
  assert.deepEqual([a.status, a.coveredBy], ["replaced", "b"]);
  const b = hr.dayStatus("b", "2026-09-14", c);
  assert.deepEqual([b.status, b.covering?.forId, b.workedMin], ["present", "a", 720]);
});

test("the month and the payroll", () => {
  const roster = ["01", "02", "03"].map((d) => cell("a", `2026-09-${d}`, "s1"));
  const c = ctx({
    roster,
    attendance: [att("a", "2026-09-01", "08:00", "14:00"), att("a", "2026-09-02", "08:30", "14:00")],
    leaves: [{ employee_id: "a", leave_type: "unpaid", from_date: "2026-09-10", to_date: "2026-09-11" }],
  });
  const m = hr.monthSummary("a", "2026-09", c);
  assert.deepEqual([m.present, m.late, m.lateMin, m.absent, m.leave, m.unpaid], [2, 1, 30, 1, 2, 2]);
  const people = [{ id: "a", full_name: "أ", base_salary: 900000, is_active: true }, { id: "z", full_name: "ز", base_salary: 500000, is_active: false }];
  const adv = [{ employee_id: "a", amount: 100000, deduct_month: "2026-09" }, { employee_id: "a", amount: 50000, deduct_month: "2026-10" }];
  const plain = hr.payroll(people, "2026-09", c, adv, hr.DEFAULT_SETTINGS);
  assert.equal(plain.length, 1, "someone who left is not on the sheet unless an advance is due");
  assert.deepEqual([plain[0].advances, plain[0].deduction, plain[0].net], [100000, 0, 800000]);
  const strict = hr.payroll(people, "2026-09", c, adv, { ...hr.DEFAULT_SETTINGS, deduct_absence: true });
  assert.deepEqual([strict[0].deduction, strict[0].net], [90000, 710000], "a day's pay for 1 absence + 2 unpaid days");
  assert.equal(hr.payrollTotals(strict).net, 710000);
});

test("leave balance counts only the annual days inside the year", () => {
  const leaves = [
    { employee_id: "a", leave_type: "annual", from_date: "2025-12-30", to_date: "2026-01-02" },
    { employee_id: "a", leave_type: "sick", from_date: "2026-03-01", to_date: "2026-03-05" },
  ];
  assert.deepEqual(hr.leaveBalance(leaves, "a", "2026", 20), { used: 2, remaining: 18 });
});

test("the database: one roster cell and one attendance row per person per day", async () => {
  const db = await bootWithMigrations();
  try {
    const e = (await db.query(`insert into hr_employees (full_name, base_salary) values ('موظف', 750000) returning id`)).rows[0].id;
    const b = (await db.query(`insert into hr_employees (full_name) values ('بديل') returning id`)).rows[0].id;
    const s = (await db.query(`insert into hr_shift_types (name, start_time, end_time) values ('صباحي', '08:00', '14:00') returning id`)).rows[0].id;

    await db.query(`select fn_hr_set_shift($1, '2026-09-14', $2)`, [e, s]);
    await db.query(`select fn_hr_set_shift($1, '2026-09-14', $2)`, [e, s]);
    await db.query(`select fn_hr_set_cover($1, '2026-09-14', $2)`, [e, b]);
    let r = await db.query(`select shift_type_id, covered_by, id from hr_roster where employee_id = $1`, [e]);
    assert.equal(r.rows.length, 1);
    assert.deepEqual([r.rows[0].shift_type_id, r.rows[0].covered_by], [s, b]);
    const expected = (await db.query(`select fn_hr_day_id('roster', $1, '2026-09-14') as id`, [e])).rows[0].id;
    assert.equal(r.rows[0].id, expected, "the id comes from the person and the day");
    await assert.rejects(db.query(`select fn_hr_set_cover($1, '2026-09-14', $1)`, [e]), /نفسه/);

    assert.equal((await db.query(`select fn_hr_copy_week('2026-09-12', '2026-09-19') as n`)).rows[0].n, 1);
    r = await db.query(`select work_date::text from hr_roster where employee_id = $1 order by work_date`, [e]);
    assert.deepEqual(r.rows.map((x) => x.work_date), ["2026-09-14", "2026-09-21"]);

    await db.query(`select fn_hr_punch($1, '2026-09-14', 'in', '08:20')`, [e]);
    await db.query(`select fn_hr_punch($1, '2026-09-14', 'out', '14:05')`, [e]);
    r = await db.query(`select check_in, check_out from hr_attendance where employee_id = $1`, [e]);
    assert.deepEqual([r.rows.length, r.rows[0].check_in, r.rows[0].check_out], [1, "08:20", "14:05"]);
    await db.query(`select fn_hr_set_attendance($1, '2026-09-14', '', '', '')`, [e]);
    assert.equal((await db.query(`select count(*)::int as n from hr_attendance`)).rows[0].n, 0, "an empty day is cleared");
    await assert.rejects(db.query(`select fn_hr_set_attendance($1, '2026-09-14', '8:2', null)`, [e]));

    await db.query(`select fn_hr_set_shift($1, '2026-09-14', null, false)`, [e]);
    assert.equal((await db.query(`select count(*)::int as n from hr_roster where work_date = '2026-09-14'`)).rows[0].n, 0);
    await assert.rejects(db.query(`insert into hr_leaves (employee_id, leave_type, from_date, to_date) values ($1, 'annual', '2026-09-10', '2026-09-09')`, [e]));
  } finally {
    await db.close();
  }
});

test("the new tables join the change log, so they sync", async () => {
  const db = await bootWithMigrations();
  try {
    const e = (await db.query(`insert into hr_employees (full_name) values ('مزامنة') returning id`)).rows[0].id;
    await db.query(`select fn_hr_punch($1, '2026-09-14', 'in', '08:00')`, [e]);
    const r = await db.query(`select distinct table_name from _spir_changes where table_name like 'hr_%' order by 1`);
    assert.deepEqual(r.rows.map((x) => x.table_name), ["hr_attendance", "hr_employees"]);
  } finally {
    await db.close();
  }
});
