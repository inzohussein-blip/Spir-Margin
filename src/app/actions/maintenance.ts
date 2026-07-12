"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface VisitPurposeInput {
  device_id: string;
  work_done?: string;
  service_person?: string;
  next_due_date?: string;
}
export interface MaintenanceVisitInput {
  visit_no: string;
  lab_id: string | null;
  visit_date: string;
  visit_time?: string;
  maintenance_type: "scheduled" | "unscheduled" | "breakdown";
  completion_status: "pending" | "partial" | "full";
  service_person?: string;
  customer_feedback?: string;
  notes?: string;
  purposes: VisitPurposeInput[];
}

/** Create a draft maintenance visit with its serviced-device rows. */
export async function saveMaintenanceVisit(input: MaintenanceVisitInput) {
  const supabase = createClient();

  const rows = input.purposes.filter((p) => p.device_id);
  if (rows.length === 0) return { ok: false as const, error: "Add at least one device" };

  const { data: header, error: hErr } = await supabase
    .from("maintenance_visits")
    .insert({
      visit_no: input.visit_no || null,
      lab_id: input.lab_id || null,
      visit_date: input.visit_date || new Date().toISOString().slice(0, 10),
      visit_time: input.visit_time || null,
      maintenance_type: input.maintenance_type,
      completion_status: input.completion_status,
      service_person: input.service_person || null,
      customer_feedback: input.customer_feedback || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = rows.map((p) => ({
    visit_id: header.id,
    device_id: p.device_id,
    work_done: p.work_done || null,
    service_person: p.service_person || null,
    next_due_date: p.next_due_date || null,
  }));
  const { error: iErr } = await supabase.from("maintenance_visit_purposes").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/maintenance-visits");
  return { ok: true as const, visitId: header.id };
}

/** Submit a visit: logs each device and rolls its next-maintenance date. */
export async function submitMaintenanceVisit(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_submit_maintenance_visit", { p_visit_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/maintenance-visits");
  revalidatePath("/devices");
  return { ok: true as const, serviced: data as number };
}

export async function cancelMaintenanceVisit(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("maintenance_visits")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/maintenance-visits");
  return { ok: true as const };
}

export async function submitMaintenanceVisitForm(fd: FormData) {
  await submitMaintenanceVisit(String(fd.get("id")));
}
export async function cancelMaintenanceVisitForm(fd: FormData) {
  await cancelMaintenanceVisit(String(fd.get("id")));
}
