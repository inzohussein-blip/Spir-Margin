"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ReconLineInput { kit_batch_id: string; counted_qty: number; }
export interface StockReconInput { posting_date: string; notes?: string; items: ReconLineInput[]; }

export async function saveStockReconciliation(input: StockReconInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.kit_batch_id && l.counted_qty !== null && l.counted_qty !== undefined);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one counted batch" };

  const { data: header, error: hErr } = await supabase
    .from("stock_reconciliations")
    .insert({ posting_date: input.posting_date || new Date().toISOString().slice(0, 10), notes: input.notes || null })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("stock_reconciliation_items").insert(
    lines.map((l) => ({ reconciliation_id: header.id, kit_batch_id: l.kit_batch_id, counted_qty: Number(l.counted_qty) }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/stock-reconciliation");
  return { ok: true as const, reconId: header.id };
}

export async function postStockReconciliationForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_post_stock_reconciliation", { p_recon_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/stock-reconciliation");
  revalidatePath("/kits");
}
