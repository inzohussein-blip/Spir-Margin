"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  const t = v == null ? "" : String(v).trim();
  return t === "" ? null : t;
}

/** Create a draft maintenance schedule (details are laid out on Generate). */
export async function createMaintenanceSchedule(fd: FormData) {
  const supabase = createClient();
  const device_id = s(fd, "device_id");
  if (!device_id) throw new Error("Device is required");
  const { error } = await supabase.from("maintenance_schedules").insert({
    schedule_no: s(fd, "schedule_no"),
    lab_id: s(fd, "lab_id"),
    device_id,
    periodicity: s(fd, "periodicity") ?? "quarterly",
    start_date: s(fd, "start_date") ?? new Date().toISOString().slice(0, 10),
    no_of_visits: Number(s(fd, "no_of_visits") ?? "4"),
    notes: s(fd, "notes"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/maintenance-schedules");
  redirect("/maintenance-schedules");
}

/** Lay out (or refresh) the dated visit rows and activate the schedule. */
export async function generateMaintenanceSchedule(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_generate_maintenance_schedule", { p_schedule_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/maintenance-schedules");
  revalidatePath("/devices");
  return { ok: true as const, generated: data as number };
}

export async function cancelMaintenanceSchedule(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("maintenance_schedules")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .neq("status", "cancelled");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/maintenance-schedules");
  return { ok: true as const };
}

export async function generateMaintenanceScheduleForm(fd: FormData) {
  await generateMaintenanceSchedule(String(fd.get("id")));
}
export async function cancelMaintenanceScheduleForm(fd: FormData) {
  await cancelMaintenanceSchedule(String(fd.get("id")));
}
