/**
 * Staff & shifts — the rules, pure (no imports), shared by the pages and the
 * tests. Ported from spir-lab-manager's roster station.
 *
 * A day for one person is judged from the roster cell (their shift, a rest
 * day, or who covers them), their attendance (arrived / left, "HH:MM"), and
 * their leave. Payroll for a month is the base salary less the advances set
 * against that month, and — when the company chooses — less a day's pay
 * (base / 30) for every absent or unpaid-leave day.
 */

export interface ShiftType { id: string; name: string; start_time: string; end_time: string; color: string }
export interface RosterCell { employee_id: string; work_date: string; shift_type_id: string | null; is_off: boolean; covered_by: string | null }
export interface Attendance { employee_id: string; work_date: string; check_in: string | null; check_out: string | null; note?: string | null }
export type LeaveType = "annual" | "sick" | "emergency" | "unpaid";
export const LEAVE_TYPES: LeaveType[] = ["annual", "sick", "emergency", "unpaid"];
export interface Leave { id?: string; employee_id: string; leave_type: LeaveType; from_date: string; to_date: string }
export interface Advance { employee_id: string; amount: number; deduct_month: string }
export interface Employee { id: string; full_name: string; base_salary: number; is_active: boolean }
export interface HrSettings { grace_minutes: number; annual_leave_days: number; week_start: number; deduct_absence: boolean }
export const DEFAULT_SETTINGS: HrSettings = { grace_minutes: 10, annual_leave_days: 20, week_start: 6, deduct_absence: false };

/** The usual three shifts, offered with one click to a company that has none. */
export const USUAL_SHIFTS = [
  { name: "صباحي", start_time: "08:00", end_time: "14:00", color: "#0ea5e9" },
  { name: "مسائي", start_time: "14:00", end_time: "20:00", color: "#f59e0b" },
  { name: "ليلي", start_time: "20:00", end_time: "08:00", color: "#6366f1" },
];

// ── Dates and times ──────────────────────────────────────────────────────────
const DAY = 86_400_000;
const utc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const ymdOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (ymd: string, n: number) => ymdOf(utc(ymd) + n * DAY);
export const weekday = (ymd: string) => new Date(utc(ymd)).getUTCDay();
/** The first day of the week `ymd` falls in, for a week that starts on `weekStart` (0 Sunday … 6 Saturday). */
export const weekStartOf = (ymd: string, weekStart: number) => addDays(ymd, -((weekday(ymd) - weekStart + 7) % 7));
export const daysInMonth = (ym: string) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
export const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
const toMin = (hm: string) => +hm.slice(0, 2) * 60 + +hm.slice(3, 5);
/** Minutes from one "HH:MM" to the next (past midnight when it goes round). */
export function minutesBetween(a: string, b: string): number {
  const d = toMin(b) - toMin(a);
  return d < 0 ? d + 1440 : d;
}
export const hoursLabel = (min: number) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;

// ── Leave ────────────────────────────────────────────────────────────────────
export const leaveDays = (l: Pick<Leave, "from_date" | "to_date">) => Math.round((utc(l.to_date) - utc(l.from_date)) / DAY) + 1;
export const leaveOn = (leaves: Leave[], employee: string, date: string) =>
  leaves.find((l) => l.employee_id === employee && l.from_date <= date && l.to_date >= date);
/** Days of `leaves` (of one type, if given) that fall inside [from, to]. */
export function leaveDaysWithin(leaves: Leave[], employee: string, from: string, to: string, type?: LeaveType): number {
  let n = 0;
  for (const l of leaves) {
    if (l.employee_id !== employee || (type && l.leave_type !== type)) continue;
    const a = l.from_date > from ? l.from_date : from;
    const b = l.to_date < to ? l.to_date : to;
    if (a <= b) n += leaveDays({ from_date: a, to_date: b });
  }
  return n;
}
/** Annual leave used in `year` and what is left of the yearly entitlement. */
export function leaveBalance(leaves: Leave[], employee: string, year: string, entitlement: number) {
  const used = leaveDaysWithin(leaves, employee, `${year}-01-01`, `${year}-12-31`, "annual");
  return { used, remaining: entitlement - used };
}

// ── A person's day ───────────────────────────────────────────────────────────
export type DayStatus = "present" | "late" | "absent" | "leave" | "off" | "pending" | "unscheduled" | "replaced";
export interface HrContext { roster: RosterCell[]; shifts: ShiftType[]; attendance: Attendance[]; leaves: Leave[]; grace: number; today: string }
export interface DayResult {
  status: DayStatus;
  lateMin: number;
  workedMin: number;
  shift?: ShiftType;
  /** Who covers this person that day. */
  coveredBy?: string;
  /** This person covers someone else that day. */
  covering?: { forId: string; shift?: ShiftType };
}

const cellOf = (ctx: HrContext, employee: string, date: string) =>
  ctx.roster.find((r) => r.employee_id === employee && r.work_date === date);

/** Whom `employee` covers on `date`, and on which shift. */
export function coverOf(ctx: HrContext, employee: string, date: string): { forId: string; shift?: ShiftType } | undefined {
  const c = ctx.roster.find((r) => r.work_date === date && r.covered_by === employee);
  if (!c) return undefined;
  return { forId: c.employee_id, shift: ctx.shifts.find((s) => s.id === c.shift_type_id) };
}

export function dayStatus(employee: string, date: string, ctx: HrContext): DayResult {
  const cell = cellOf(ctx, employee, date);
  const covering = coverOf(ctx, employee, date);
  if (leaveOn(ctx.leaves, employee, date)) return { status: "leave", lateMin: 0, workedMin: 0, coveredBy: cell?.covered_by ?? undefined };
  const a = ctx.attendance.find((x) => x.employee_id === employee && x.work_date === date);
  const worked = a && isTime(a.check_in) && isTime(a.check_out) ? minutesBetween(a.check_in, a.check_out) : 0;
  const shift = (cell?.shift_type_id ? ctx.shifts.find((s) => s.id === cell.shift_type_id) : undefined) ?? covering?.shift;
  if (!shift) {
    if (cell?.is_off) return { status: "off", lateMin: 0, workedMin: worked, covering };
    return { status: a?.check_in ? "present" : "unscheduled", lateMin: 0, workedMin: worked, covering };
  }
  if (!a?.check_in) {
    if (cell?.covered_by) return { status: "replaced", lateMin: 0, workedMin: 0, shift, coveredBy: cell.covered_by };
    return { status: date < ctx.today ? "absent" : "pending", lateMin: 0, workedMin: 0, shift, covering };
  }
  const late = minutesBetween(shift.start_time, a.check_in);
  // Arriving early wraps round past midnight: only a delay under 12 hours counts.
  const lateMin = late < 12 * 60 && late > ctx.grace ? late : 0;
  return { status: lateMin ? "late" : "present", lateMin, workedMin: worked, shift, covering };
}

export interface MonthSummary { present: number; late: number; absent: number; leave: number; lateMin: number; workedMin: number; covered: number; replaced: number; unpaid: number }

/** One person's month ("YYYY-MM"), counting the days up to today. */
export function monthSummary(employee: string, ym: string, ctx: HrContext): MonthSummary {
  const s: MonthSummary = { present: 0, late: 0, absent: 0, leave: 0, lateMin: 0, workedMin: 0, covered: 0, replaced: 0, unpaid: 0 };
  const days = daysInMonth(ym);
  for (let i = 1; i <= days; i++) {
    const d = `${ym}-${String(i).padStart(2, "0")}`;
    if (d > ctx.today) break;
    const r = dayStatus(employee, d, ctx);
    if (r.status === "present" || r.status === "late") s.present++;
    if (r.status === "late") { s.late++; s.lateMin += r.lateMin; }
    if (r.status === "absent") s.absent++;
    if (r.status === "leave") s.leave++;
    if (r.status === "replaced") s.replaced++;
    if (r.covering && (r.status === "present" || r.status === "late")) s.covered++;
    s.workedMin += r.workedMin;
  }
  s.unpaid = leaveDaysWithin(ctx.leaves, employee, `${ym}-01`, `${ym}-${String(days).padStart(2, "0")}`, "unpaid");
  return s;
}

// ── Payroll ──────────────────────────────────────────────────────────────────
export interface PayrollRow {
  employee: Employee;
  base: number;
  absent: number;
  unpaid: number;
  lateMin: number;
  advances: number;
  deduction: number;
  net: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function payroll(employees: Employee[], ym: string, ctx: HrContext, advances: Advance[], settings: HrSettings): PayrollRow[] {
  return employees
    .filter((e) => e.is_active || advances.some((a) => a.employee_id === e.id && a.deduct_month === ym))
    .map((e) => {
      const m = monthSummary(e.id, ym, ctx);
      const adv = round2(advances.filter((a) => a.employee_id === e.id && a.deduct_month === ym).reduce((t, a) => t + Number(a.amount), 0));
      const base = Number(e.base_salary) || 0;
      const deduction = settings.deduct_absence ? round2((base / 30) * (m.absent + m.unpaid)) : 0;
      return { employee: e, base, absent: m.absent, unpaid: m.unpaid, lateMin: m.lateMin, advances: adv, deduction, net: round2(base - adv - deduction) };
    });
}

export function payrollTotals(rows: PayrollRow[]) {
  return rows.reduce(
    (t, r) => ({ base: round2(t.base + r.base), advances: round2(t.advances + r.advances), deduction: round2(t.deduction + r.deduction), net: round2(t.net + r.net) }),
    { base: 0, advances: 0, deduction: 0, net: 0 },
  );
}
