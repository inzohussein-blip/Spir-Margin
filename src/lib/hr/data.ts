import "server-only";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/dates";
import {
  DEFAULT_SETTINGS, type Advance, type Attendance, type HrContext, type HrSettings, type Leave, type RosterCell, type ShiftType,
} from "./core";

/** What the staff pages read, for a range of days. */

export interface EmployeeRow {
  id: string; code: string | null; full_name: string; job_title: string | null; department: string | null; phone: string | null;
  hire_date: string | null; base_salary: number; currency: string; color: string; is_active: boolean; notes: string | null;
}

export async function hrSettings(): Promise<HrSettings> {
  const { data } = await createClient().from("hr_settings").select("grace_minutes, annual_leave_days, week_start, deduct_absence").limit(1);
  const r = (data as HrSettings[] | null)?.[0];
  return r ? { ...DEFAULT_SETTINGS, ...r } : DEFAULT_SETTINGS;
}

export async function hrEmployees(activeOnly = false): Promise<EmployeeRow[]> {
  let q = createClient().from("hr_employees")
    .select("id, code, full_name, job_title, department, phone, hire_date, base_salary, currency, color, is_active, notes")
    .order("full_name");
  if (activeOnly) q = q.eq("is_active", true);
  const { data } = await q;
  return ((data as EmployeeRow[] | null) ?? []).map((e) => ({ ...e, base_salary: Number(e.base_salary) || 0 }));
}

export async function hrShifts(): Promise<ShiftType[]> {
  const { data } = await createClient().from("hr_shift_types").select("id, name, start_time, end_time, color").order("start_time");
  return (data as ShiftType[] | null) ?? [];
}

/** Roster, attendance and leave for [from, to], ready for `dayStatus`. */
export async function hrContext(from: string, to: string): Promise<HrContext> {
  const supabase = createClient();
  const [settings, shifts, roster, attendance, leaves] = await Promise.all([
    hrSettings(),
    hrShifts(),
    supabase.from("hr_roster").select("employee_id, work_date, shift_type_id, is_off, covered_by").gte("work_date", from).lte("work_date", to),
    supabase.from("hr_attendance").select("employee_id, work_date, check_in, check_out, note").gte("work_date", from).lte("work_date", to),
    supabase.from("hr_leaves").select("id, employee_id, leave_type, from_date, to_date").lte("from_date", to).gte("to_date", from),
  ]);
  const day = (v: unknown) => String(v ?? "").slice(0, 10);
  return {
    roster: ((roster.data as RosterCell[] | null) ?? []).map((r) => ({ ...r, work_date: day(r.work_date) })),
    attendance: ((attendance.data as Attendance[] | null) ?? []).map((a) => ({ ...a, work_date: day(a.work_date) })),
    leaves: ((leaves.data as Leave[] | null) ?? []).map((l) => ({ ...l, from_date: day(l.from_date), to_date: day(l.to_date) })),
    shifts,
    grace: settings.grace_minutes,
    today: localDate(),
  };
}

export async function hrAdvances(month?: string): Promise<(Advance & { id: string; advance_date: string; note: string | null })[]> {
  let q = createClient().from("hr_advances").select("id, employee_id, amount, advance_date, deduct_month, note").order("advance_date", { ascending: false });
  if (month) q = q.eq("deduct_month", month);
  const { data } = await q;
  return ((data as (Advance & { id: string; advance_date: string; note: string | null })[] | null) ?? [])
    .map((a) => ({ ...a, amount: Number(a.amount) || 0, advance_date: String(a.advance_date).slice(0, 10) }));
}
