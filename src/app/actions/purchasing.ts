"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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
  payment_term_id?: string | null;
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
      payment_term_id: input.payment_term_id || null,
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

/** Create a reusable payment term (ported from ERPNext "Payment Term"). */
export async function createPaymentTerm(fd: FormData) {
  const supabase = createClient();
  const name = String(fd.get("name") ?? "").trim();
  if (!name) throw new Error('Field "name" is required');
  const { error } = await supabase.from("payment_terms").insert({
    name,
    due_date_based_on: String(fd.get("due_date_based_on") ?? "day_after_invoice"),
    credit_days: Number(fd.get("credit_days") ?? 0),
    credit_months: Number(fd.get("credit_months") ?? 0),
    invoice_portion: Number(fd.get("invoice_portion") ?? 100),
    mode_of_payment: (String(fd.get("mode_of_payment") ?? "").trim() || null),
    description: (String(fd.get("description") ?? "").trim() || null),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/payment-terms");
  redirect("/payment-terms");
}

/** FormData wrapper so the receive/cancel buttons can be plain <form> posts. */
export async function receivePurchaseForm(fd: FormData) {
  await receivePurchase(String(fd.get("id")));
}
export async function cancelPurchaseForm(fd: FormData) {
  await cancelPurchase(String(fd.get("id")));
}
