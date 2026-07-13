"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

/** Create an install/service appointment (ported from ERPNext "Appointment"). */
export async function createAppointment(fd: FormData) {
  const supabase = createClient();
  const appointment_no = str(fd, "appointment_no");
  if (!appointment_no) throw new Error("Appointment no. is required");
  const when = str(fd, "scheduled_time");
  const { error } = await supabase.from("appointments").insert({
    appointment_no,
    lab_id: str(fd, "lab_id"),
    device_id: str(fd, "device_id"),
    purpose: str(fd, "purpose") ?? "service",
    scheduled_time: when ? new Date(when).toISOString() : new Date().toISOString(),
    status: str(fd, "status") ?? "open",
    contact_name: str(fd, "contact_name"),
    contact_phone: str(fd, "contact_phone"),
    notes: str(fd, "notes"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/appointments");
  redirect("/appointments");
}

export async function setAppointmentStatusForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("appointments")
    .update({ status: String(fd.get("status")), updated_at: new Date().toISOString() })
    .eq("id", String(fd.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/appointments");
}
