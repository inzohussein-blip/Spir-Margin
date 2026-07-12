"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface InstallLineInput {
  device_id: string;
  serial_no?: string;
  qty?: number;
}
export interface InstallationNoteInput {
  inst_no: string;
  lab_id: string | null;
  inst_date: string;
  inst_time?: string;
  remarks?: string;
  items: InstallLineInput[];
}

/** Create a draft installation note with its device rows. */
export async function saveInstallationNote(input: InstallationNoteInput) {
  const supabase = createClient();

  const rows = input.items.filter((l) => l.device_id);
  if (rows.length === 0) return { ok: false as const, error: "Add at least one device" };

  const { data: header, error: hErr } = await supabase
    .from("installation_notes")
    .insert({
      inst_no: input.inst_no || null,
      lab_id: input.lab_id || null,
      inst_date: input.inst_date || new Date().toISOString().slice(0, 10),
      inst_time: input.inst_time || null,
      remarks: input.remarks || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = rows.map((l) => ({
    note_id: header.id,
    device_id: l.device_id,
    serial_no: l.serial_no || null,
    qty: Number(l.qty) || 1,
  }));
  const { error: iErr } = await supabase.from("installation_note_items").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/installation-notes");
  return { ok: true as const, noteId: header.id };
}

/** Submit a note: mark each linked device installed at the lab. */
export async function submitInstallationNote(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_submit_installation_note", { p_note_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/installation-notes");
  revalidatePath("/devices");
  return { ok: true as const, installed: data as number };
}

export async function cancelInstallationNote(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("installation_notes")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/installation-notes");
  return { ok: true as const };
}

export async function submitInstallationNoteForm(fd: FormData) {
  await submitInstallationNote(String(fd.get("id")));
}
export async function cancelInstallationNoteForm(fd: FormData) {
  await cancelInstallationNote(String(fd.get("id")));
}
