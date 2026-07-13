"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface RfqLineInput { product_id: string; qty: number; }
export interface RfqInput {
  rfq_no: string;
  transaction_date: string;
  schedule_date?: string | null;
  message?: string;
  items: RfqLineInput[];
  supplier_ids: string[];
}

/** Create a draft RFQ with item lines and target suppliers. */
export async function saveRfq(input: RfqInput) {
  const supabase = createClient();
  const items = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  const suppliers = input.supplier_ids.filter(Boolean);
  if (items.length === 0) return { ok: false as const, error: "Add at least one item" };
  if (suppliers.length === 0) return { ok: false as const, error: "Select at least one supplier" };

  const { data: header, error: hErr } = await supabase
    .from("rfqs")
    .insert({
      rfq_no: input.rfq_no || null,
      transaction_date: input.transaction_date || new Date().toISOString().slice(0, 10),
      schedule_date: input.schedule_date || null,
      message: input.message || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const iErr = (
    await supabase
      .from("rfq_items")
      .insert(items.map((l) => ({ rfq_id: header.id, product_id: l.product_id, qty: Number(l.qty) })))
  ).error;
  if (iErr) return { ok: false as const, error: iErr.message };

  const sErr = (
    await supabase
      .from("rfq_suppliers")
      .insert(suppliers.map((s) => ({ rfq_id: header.id, supplier_id: s })))
  ).error;
  if (sErr) return { ok: false as const, error: sErr.message };

  revalidatePath("/rfqs");
  return { ok: true as const, rfqId: header.id };
}

export async function submitRfqForm(fd: FormData) {
  const supabase = createClient();
  await supabase.rpc("fn_submit_rfq", { p_rfq_id: String(fd.get("id")) });
  revalidatePath("/rfqs");
}

/** Convert one supplier's RFQ line into a draft supplier quotation. */
export async function rfqToQuotationForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_rfq_to_supplier_quotation", {
    p_rfq_supplier_id: String(fd.get("rfq_supplier_id")),
    p_quote_no: String(fd.get("quote_no") || `SQ-${Date.now()}`),
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/rfqs/${fd.get("rfq_id")}`);
  revalidatePath("/supplier-quotations");
}
