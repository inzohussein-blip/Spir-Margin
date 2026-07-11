"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface MRLineInput { product_id: string; qty: number; warehouse_id?: string; }
export interface MaterialRequestInput { transaction_date: string; required_by?: string | null; notes?: string; items: MRLineInput[]; }

export async function saveMaterialRequest(input: MaterialRequestInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: header, error: hErr } = await supabase
    .from("material_requests")
    .insert({ transaction_date: input.transaction_date || new Date().toISOString().slice(0, 10), required_by: input.required_by || null, notes: input.notes || null })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("material_request_items").insert(
    lines.map((l) => ({ material_request_id: header.id, product_id: l.product_id, qty: Number(l.qty), warehouse_id: l.warehouse_id || null }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/material-requests");
  return { ok: true as const, materialRequestId: header.id };
}

export async function convertMaterialRequestForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_material_request_to_purchase", { p_mr_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/material-requests");
  revalidatePath("/purchases");
}
