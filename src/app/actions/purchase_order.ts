"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PoLineInput {
  product_id: string;
  qty: number;
  rate: number;
}
export interface PurchaseOrderInput {
  po_no: string;
  supplier_id: string | null;
  transaction_date: string;
  required_by?: string | null;
  notes?: string;
  items: PoLineInput[];
}

/** Create a draft purchase order with its line items. */
export async function savePurchaseOrder(input: PurchaseOrderInput) {
  const supabase = createClient();

  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: header, error: hErr } = await supabase
    .from("purchase_orders")
    .insert({
      po_no: input.po_no || null,
      supplier_id: input.supplier_id || null,
      transaction_date: input.transaction_date || new Date().toISOString().slice(0, 10),
      required_by: input.required_by || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = lines.map((l) => ({
    po_id: header.id,
    product_id: l.product_id,
    qty: Number(l.qty),
    rate: Number(l.rate) || 0,
  }));
  const { error: iErr } = await supabase.from("purchase_order_items").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/purchase-orders");
  return { ok: true as const, poId: header.id };
}

/**
 * Update a DRAFT purchase order: header + full replace of line items. Only
 * draft POs are editable (a submitted PO may already be billed). Captured by
 * the audit trigger (migration 0075) → Monitoring → Change & Deletion Log.
 */
export async function updatePurchaseOrder(id: string, input: PurchaseOrderInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: existing } = await supabase.from("purchase_orders").select("status").eq("id", id).single();
  if (!existing) return { ok: false as const, error: "Order not found" };
  if ((existing as { status: string }).status !== "draft") {
    return { ok: false as const, error: "Only draft orders can be edited" };
  }

  const { error: hErr } = await supabase
    .from("purchase_orders")
    .update({
      po_no: input.po_no || null,
      supplier_id: input.supplier_id || null,
      transaction_date: input.transaction_date || new Date().toISOString().slice(0, 10),
      required_by: input.required_by || null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "draft");
  if (hErr) return { ok: false as const, error: hErr.message };

  await supabase.from("purchase_order_items").delete().eq("po_id", id);
  const { error: iErr } = await supabase.from("purchase_order_items").insert(
    lines.map((l) => ({ po_id: id, product_id: l.product_id, qty: Number(l.qty), rate: Number(l.rate) || 0 }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/purchase-orders");
  revalidatePath(`/purchase-orders/${id}`);
  return { ok: true as const, poId: id };
}

/** Delete a draft or cancelled purchase order (items cascade). */
export async function deletePurchaseOrderForm(fd: FormData) {
  const supabase = createClient();
  const id = String(fd.get("id"));
  const { error } = await supabase
    .from("purchase_orders")
    .delete()
    .eq("id", id)
    .in("status", ["draft", "cancelled"]);
  if (error) throw new Error(error.message);
  revalidatePath("/purchase-orders");
}

export async function submitPurchaseOrder(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_submit_purchase_order", { p_po_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/purchase-orders");
  return { ok: true as const };
}

/** Convert a PO into a draft purchase invoice. */
export async function poToPurchaseInvoice(id: string, reference?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_po_to_purchase_invoice", {
    p_po_id: id,
    p_reference: reference || null,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/purchase-orders");
  revalidatePath("/purchases");
  return { ok: true as const, purchaseId: data as string };
}

export async function cancelPurchaseOrder(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "submitted"]);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/purchase-orders");
  return { ok: true as const };
}

export async function submitPurchaseOrderForm(fd: FormData) {
  await submitPurchaseOrder(String(fd.get("id")));
}
export async function poToPurchaseInvoiceForm(fd: FormData) {
  await poToPurchaseInvoice(String(fd.get("id")), String(fd.get("reference") ?? ""));
}
export async function cancelPurchaseOrderForm(fd: FormData) {
  await cancelPurchaseOrder(String(fd.get("id")));
}
