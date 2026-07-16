"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PickLineInput {
  product_id: string;
  warehouse_id?: string;
  qty: number;
  batch_no?: string;
}
export interface PickListInput {
  pick_no: string;
  lab_id: string | null;
  sales_order_id: string | null;
  purpose: "delivery" | "material_transfer";
  posting_date: string;
  notes?: string;
  items: PickLineInput[];
}

export async function savePickList(input: PickListInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const pickNo = input.pick_no?.trim() || `PICK-${Date.now().toString().slice(-8)}`;
  const { data: header, error: hErr } = await supabase
    .from("pick_lists")
    .insert({
      pick_no: pickNo,
      lab_id: input.lab_id || null,
      sales_order_id: input.sales_order_id || null,
      purpose: input.purpose,
      posting_date: input.posting_date || new Date().toISOString().slice(0, 10),
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("pick_list_items").insert(
    lines.map((l) => ({
      pick_id: header.id,
      product_id: l.product_id,
      warehouse_id: l.warehouse_id || null,
      qty: Number(l.qty),
      batch_no: l.batch_no || null,
    }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/pick-lists");
  return { ok: true as const, pickId: header.id };
}

export async function openPickListForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_open_pick_list", { p_pick_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/pick-lists");
}

export async function completePickListForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_complete_pick_list", { p_pick_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/pick-lists");
}

export async function cancelPickListForm(fd: FormData) {
  const supabase = createClient();
  await supabase.from("pick_lists").update({ status: "cancelled" }).eq("id", String(fd.get("id"))).neq("status", "completed");
  revalidatePath("/pick-lists");
}
