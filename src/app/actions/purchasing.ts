"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PurchaseLineInput {
  product_id: string;
  qty: number;
  rate: number;
  batch_no?: string;
  expiry_date?: string;
  warehouse_id?: string;
}
export interface PurchaseInput {
  supplier_id: string | null;
  posting_date: string;
  reference_no?: string;
  notes?: string;
  items: PurchaseLineInput[];
}

/** Create a draft purchase invoice with its line items. */
export async function savePurchase(input: PurchaseInput) {
  const supabase = createClient();

  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: header, error: hErr } = await supabase
    .from("purchase_invoices")
    .insert({
      supplier_id: input.supplier_id || null,
      posting_date: input.posting_date || new Date().toISOString().slice(0, 10),
      reference_no: input.reference_no || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = lines.map((l) => ({
    purchase_id: header.id,
    product_id: l.product_id,
    qty: Number(l.qty),
    rate: Number(l.rate) || 0,
    batch_no: l.batch_no || null,
    expiry_date: l.expiry_date || null,
    warehouse_id: l.warehouse_id || null,
  }));
  const { error: iErr } = await supabase.from("purchase_items").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/purchases");
  return { ok: true as const, purchaseId: header.id };
}

/** Receive a draft purchase into stock (creates kit batches / devices). */
export async function receivePurchase(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_receive_purchase", {
    p_purchase_id: id,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/purchases");
  revalidatePath("/kits");
  revalidatePath("/devices");
  return { ok: true as const, created: data as number };
}

export async function cancelPurchase(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("purchase_invoices")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/purchases");
  return { ok: true as const };
}

/** FormData wrapper so the receive/cancel buttons can be plain <form> posts. */
export async function receivePurchaseForm(fd: FormData) {
  await receivePurchase(String(fd.get("id")));
}
export async function cancelPurchaseForm(fd: FormData) {
  await cancelPurchase(String(fd.get("id")));
}
