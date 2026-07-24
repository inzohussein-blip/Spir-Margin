"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface QLineInput { product_id: string; qty: number; rate: number; }
export interface QuotationInput { lab_id: string; transaction_date: string; valid_till?: string | null; notes?: string; items: QLineInput[]; }

export async function saveQuotation(input: QuotationInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (!input.lab_id) return { ok: false as const, error: "Pick a lab" };
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: header, error: hErr } = await supabase
    .from("quotations")
    .insert({
      lab_id: input.lab_id,
      transaction_date: input.transaction_date || new Date().toISOString().slice(0, 10),
      valid_till: input.valid_till || null,
      status: "submitted",
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("quotation_items").insert(
    lines.map((l) => ({ quotation_id: header.id, product_id: l.product_id, qty: Number(l.qty), rate: Number(l.rate) || 0 }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/quotations");
  return { ok: true as const, quotationId: header.id };
}

/** Edit a quotation that has not yet become a sales order. Once a quotation
 *  is "ordered" it is locked — the downstream order is the source of truth. */
export async function updateQuotation(id: string, input: QuotationInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (!input.lab_id) return { ok: false as const, error: "Pick a lab" };
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: existing } = await supabase.from("quotations").select("status").eq("id", id).single();
  if (!existing) return { ok: false as const, error: "Quotation not found" };
  if ((existing as { status: string }).status === "ordered") {
    return { ok: false as const, error: "A quotation that became an order cannot be edited" };
  }

  const { error: hErr } = await supabase
    .from("quotations")
    .update({
      lab_id: input.lab_id,
      transaction_date: input.transaction_date || new Date().toISOString().slice(0, 10),
      valid_till: input.valid_till || null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .neq("status", "ordered");
  if (hErr) return { ok: false as const, error: hErr.message };

  await supabase.from("quotation_items").delete().eq("quotation_id", id);
  const { error: iErr } = await supabase.from("quotation_items").insert(
    lines.map((l) => ({ quotation_id: id, product_id: l.product_id, qty: Number(l.qty), rate: Number(l.rate) || 0 }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/quotations");
  revalidatePath(`/quotations/${id}`);
  return { ok: true as const, quotationId: id };
}

/** Delete a quotation that never became an order. */
export async function deleteQuotationForm(fd: FormData) {
  const supabase = createClient();
  const id = String(fd.get("id"));
  const { error } = await supabase.from("quotations").delete().eq("id", id).neq("status", "ordered");
  if (error) throw new Error(error.message);
  revalidatePath("/quotations");
}

export async function convertQuotationForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_quotation_to_sales_order", { p_quote_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/quotations");
  revalidatePath("/sales-orders");
}
