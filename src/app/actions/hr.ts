"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertFeature } from "@/lib/features";
import { formError } from "@/lib/db/form-error";
import { localDate } from "@/lib/dates";
import { isTime, USUAL_SHIFTS, LEAVE_TYPES, type LeaveType } from "@/lib/hr/core";

/**
 * Staff & shifts (migration 0117). Every write is checked against the HR
 * feature, like the rest of the app's actions; the roster and attendance go
 * through the database functions that keep one row per person per day.
 */

const FEATURE = "HR";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
const ymd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const ym = (v: string | null) => (v && /^\d{4}-\d{2}$/.test(v) ? v : null);
const nowHm = () => new Date().toTimeString().slice(0, 5);
/** Back to the page the form came from (same-origin paths only). */
const backTo = (fd: FormData, fallback: string) => {
  const b = str(fd, "back");
  return b && b.startsWith("/hr") && !b.startsWith("//") ? b : fallback;
};
const withSaved = (href: string, kind: "created" | "updated" | "deleted") => `${href}${href.includes("?") ? "&" : "?"}saved=${kind}`;

// ── Employees ────────────────────────────────────────────────────────────────
function employeeFields(fd: FormData) {
  return {
    code: str(fd, "code"),
    full_name: str(fd, "full_name") ?? "",
    job_title: str(fd, "job_title"),
    department: str(fd, "department"),
    phone: str(fd, "phone"),
    hire_date: ymd(str(fd, "hire_date")),
    base_salary: Math.max(0, Number(str(fd, "base_salary") ?? 0) || 0),
    currency: str(fd, "currency") === "USD" ? "USD" : "IQD",
    color: /^#[0-9a-fA-F]{6}$/.test(str(fd, "color") ?? "") ? str(fd, "color")! : "#0284c7",
    is_active: fd.get("is_active") != null,
    notes: str(fd, "notes"),
  };
}

export async function createEmployee(fd: FormData) {
  await assertFeature(FEATURE);
  const row = employeeFields(fd);
  if (!row.full_name) return { error: "Enter the employee's name" };
  const { error } = await createClient().from("hr_employees").insert({ ...row, is_active: true });
  if (error) return formError(error);
  revalidatePath("/hr/employees");
  redirect("/hr/employees?saved=created");
}

export async function updateEmployee(id: string, fd: FormData) {
  await assertFeature(FEATURE);
  const row = employeeFields(fd);
  if (!row.full_name) return { error: "Enter the employee's name" };
  const { error } = await createClient().from("hr_employees").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return formError(error);
  revalidatePath("/hr/employees");
  redirect("/hr/employees?saved=updated");
}

// ── Shifts and rules ─────────────────────────────────────────────────────────
export async function createShiftType(fd: FormData) {
  await assertFeature(FEATURE);
  const name = str(fd, "name");
  const start = str(fd, "start_time");
  const end = str(fd, "end_time");
  if (!name || !isTime(start) || !isTime(end)) return { error: "Enter the shift's name and its start and end times" };
  const color = /^#[0-9a-fA-F]{6}$/.test(str(fd, "color") ?? "") ? str(fd, "color")! : "#0ea5e9";
  const { error } = await createClient().from("hr_shift_types").insert({ name, start_time: start, end_time: end, color });
  if (error) return formError(error);
  revalidatePath("/hr/shifts");
  redirect("/hr/shifts?saved=created");
}

export async function addUsualShifts() {
  await assertFeature(FEATURE);
  const supabase = createClient();
  const { data } = await supabase.from("hr_shift_types").select("name");
  const have = new Set(((data as { name: string }[] | null) ?? []).map((r) => r.name));
  const missing = USUAL_SHIFTS.filter((s) => !have.has(s.name));
  if (missing.length) {
    const { error } = await supabase.from("hr_shift_types").insert(missing);
    if (error) return formError(error);
  }
  revalidatePath("/hr/shifts");
  redirect("/hr/shifts?saved=created");
}

export async function deleteShiftType(fd: FormData) {
  await assertFeature(FEATURE);
  const id = str(fd, "id");
  if (!id) return { error: "Nothing to delete" };
  const { error } = await createClient().from("hr_shift_types").delete().eq("id", id);
  if (error) return formError(error);
  revalidatePath("/hr/shifts");
  redirect("/hr/shifts?saved=deleted");
}

export async function saveHrSettings(fd: FormData) {
  await assertFeature(FEATURE);
  const clamp = (v: string | null, lo: number, hi: number, dflt: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) && v != null ? Math.min(hi, Math.max(lo, n)) : dflt;
  };
  const { error } = await createClient().from("hr_settings").upsert(
    {
      only_row: true,
      grace_minutes: clamp(str(fd, "grace_minutes"), 0, 240, 10),
      annual_leave_days: clamp(str(fd, "annual_leave_days"), 0, 365, 20),
      week_start: clamp(str(fd, "week_start"), 0, 6, 6),
      deduct_absence: fd.get("deduct_absence") != null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "only_row" },
  );
  if (error) return formError(error);
  revalidatePath("/hr", "layout");
  redirect("/hr/shifts?saved=updated");
}

// ── Roster ───────────────────────────────────────────────────────────────────
/** One cell of the weekly roster: a shift id, "off" (rest day), or "" (clear). */
export async function setRosterCell(employee: string, date: string, value: string): Promise<{ error?: string }> {
  await assertFeature(FEATURE);
  if (!ymd(date)) return { error: "Invalid date" };
  const off = value === "off";
  const { error } = await createClient().rpc("fn_hr_set_shift", {
    p_employee: employee, p_date: date, p_shift: off || !value ? null : value, p_off: off,
  });
  if (error) return formError(error);
  revalidatePath("/hr/roster");
  return {};
}

/** Who covers someone's day ("" clears it). */
export async function setCover(employee: string, date: string, by: string): Promise<{ error?: string }> {
  await assertFeature(FEATURE);
  if (!ymd(date)) return { error: "Invalid date" };
  const { error } = await createClient().rpc("fn_hr_set_cover", { p_employee: employee, p_date: date, p_by: by || null });
  if (error) return formError(error);
  revalidatePath("/hr/roster");
  revalidatePath("/hr/attendance");
  return {};
}

export async function copyWeek(fd: FormData) {
  await assertFeature(FEATURE);
  const from = ymd(str(fd, "from"));
  const to = ymd(str(fd, "to"));
  if (!from || !to) return { error: "Invalid date" };
  const { error } = await createClient().rpc("fn_hr_copy_week", { p_from: from, p_to: to });
  if (error) return formError(error);
  revalidatePath("/hr/roster");
  redirect(`/hr/roster?week=${to}&saved=updated`);
}

// ── Attendance ───────────────────────────────────────────────────────────────
/** "Arrived" / "Left" now, for today. */
export async function punch(fd: FormData) {
  await assertFeature(FEATURE);
  const employee = str(fd, "employee");
  const kind = str(fd, "kind");
  if (!employee || (kind !== "in" && kind !== "out")) return { error: "Nothing to record" };
  const { error } = await createClient().rpc("fn_hr_punch", { p_employee: employee, p_date: localDate(), p_kind: kind, p_time: nowHm() });
  if (error) return formError(error);
  revalidatePath("/hr/attendance");
  redirect(withSaved(backTo(fd, "/hr/attendance"), "updated"));
}

/** A day's times typed by hand (a forgotten punch, a correction). */
export async function saveAttendance(fd: FormData) {
  await assertFeature(FEATURE);
  const employee = str(fd, "employee");
  const date = ymd(str(fd, "date"));
  const cin = str(fd, "check_in");
  const cout = str(fd, "check_out");
  if (!employee || !date) return { error: "Nothing to record" };
  if ((cin && !isTime(cin)) || (cout && !isTime(cout))) return { error: "Write the time as HH:MM, e.g. 08:15" };
  const { error } = await createClient().rpc("fn_hr_set_attendance", {
    p_employee: employee, p_date: date, p_in: cin, p_out: cout, p_note: str(fd, "note"),
  });
  if (error) return formError(error);
  revalidatePath("/hr/attendance");
  redirect(withSaved(backTo(fd, "/hr/attendance"), "updated"));
}

// ── Leave ────────────────────────────────────────────────────────────────────
export async function createLeave(fd: FormData) {
  await assertFeature(FEATURE);
  const employee = str(fd, "employee_id");
  const type = str(fd, "leave_type") as LeaveType | null;
  const from = ymd(str(fd, "from_date"));
  const to = ymd(str(fd, "to_date")) ?? from;
  if (!employee || !type || !LEAVE_TYPES.includes(type) || !from || !to) return { error: "Choose the employee, the kind of leave and its dates" };
  if (to < from) return { error: "The leave ends before it starts" };
  const { error } = await createClient().from("hr_leaves").insert({ employee_id: employee, leave_type: type, from_date: from, to_date: to, note: str(fd, "note") });
  if (error) return formError(error);
  revalidatePath("/hr/leaves");
  redirect("/hr/leaves?saved=created");
}

export async function deleteLeave(fd: FormData) {
  await assertFeature(FEATURE);
  const id = str(fd, "id");
  if (!id) return { error: "Nothing to delete" };
  const { error } = await createClient().from("hr_leaves").delete().eq("id", id);
  if (error) return formError(error);
  revalidatePath("/hr/leaves");
  redirect("/hr/leaves?saved=deleted");
}

// ── Advances ─────────────────────────────────────────────────────────────────
export async function createAdvance(fd: FormData) {
  await assertFeature(FEATURE);
  const employee = str(fd, "employee_id");
  const amount = Number(str(fd, "amount"));
  const date = ymd(str(fd, "advance_date")) ?? localDate();
  const month = ym(str(fd, "deduct_month")) ?? date.slice(0, 7);
  if (!employee || !(amount > 0)) return { error: "Choose the employee and enter the amount" };
  const { error } = await createClient().from("hr_advances").insert({ employee_id: employee, amount, advance_date: date, deduct_month: month, note: str(fd, "note") });
  if (error) return formError(error);
  revalidatePath("/hr/advances");
  revalidatePath("/hr/payroll");
  redirect("/hr/advances?saved=created");
}

export async function deleteAdvance(fd: FormData) {
  await assertFeature(FEATURE);
  const id = str(fd, "id");
  if (!id) return { error: "Nothing to delete" };
  const { error } = await createClient().from("hr_advances").delete().eq("id", id);
  if (error) return formError(error);
  revalidatePath("/hr/advances");
  revalidatePath("/hr/payroll");
  redirect("/hr/advances?saved=deleted");
}
