"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface QuoteLineInput { product_id: string; qty: number; rate: number; }
export interface QuotationInput {
  lab_id: string;
  transaction_date: string;
  valid_till?: string | null;
  notes?: string;
  items: QuoteLineInput[];
}

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
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("quotation_items").insert(
    lines.map((l) => ({
      quotation_id: header.id,
      product_id: l.product_id,
      qty: Number(l.qty),
      rate: Number(l.rate) || 0,
    }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/quotations");
  return { ok: true as const, quotationId: header.id };
}

export async function convertQuotationForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_quotation_to_sales_order", {
    p_quote_id: String(fd.get("id")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/quotations");
  revalidatePath("/sales-orders");
}
