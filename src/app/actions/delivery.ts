"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface DNLineInput { kit_batch_id: string; qty: number; }
export interface DeliveryNoteInput { lab_id: string; posting_date: string; notes?: string; items: DNLineInput[]; }

export async function saveDeliveryNote(input: DeliveryNoteInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.kit_batch_id && Number(l.qty) > 0);
  if (!input.lab_id) return { ok: false as const, error: "Pick a lab" };
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: header, error: hErr } = await supabase
    .from("delivery_notes")
    .insert({ lab_id: input.lab_id, posting_date: input.posting_date || new Date().toISOString().slice(0, 10), notes: input.notes || null })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("delivery_note_items").insert(
    lines.map((l) => ({ delivery_note_id: header.id, kit_batch_id: l.kit_batch_id, qty: Number(l.qty) }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/delivery-notes");
  return { ok: true as const, deliveryNoteId: header.id };
}

export async function submitDeliveryNoteForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_submit_delivery_note", { p_dn_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/delivery-notes");
  revalidatePath("/kits");
  revalidatePath("/labs");
}
