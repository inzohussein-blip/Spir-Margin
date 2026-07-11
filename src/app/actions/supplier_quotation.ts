"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SQLineInput { product_id: string; qty: number; rate: number; }
export interface SupplierQuotationInput { supplier_id: string | null; transaction_date: string; valid_till?: string | null; notes?: string; items: SQLineInput[]; }

export async function saveSupplierQuotation(input: SupplierQuotationInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: header, error: hErr } = await supabase
    .from("supplier_quotations")
    .insert({ supplier_id: input.supplier_id || null, transaction_date: input.transaction_date || new Date().toISOString().slice(0, 10), valid_till: input.valid_till || null, status: "submitted", notes: input.notes || null })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("supplier_quotation_items").insert(
    lines.map((l) => ({ supplier_quotation_id: header.id, product_id: l.product_id, qty: Number(l.qty), rate: Number(l.rate) || 0 }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/supplier-quotations");
  return { ok: true as const, id: header.id };
}

export async function convertSupplierQuotationForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_supplier_quotation_to_purchase", { p_sq_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/supplier-quotations");
  revalidatePath("/purchases");
}
