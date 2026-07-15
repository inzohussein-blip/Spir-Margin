"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ReceiptLineInput {
  product_id: string;
  qty: number;
  rate: number;
  warehouse_id?: string;
  batch_no?: string;
  expiry_date?: string;
}
export interface PurchaseReceiptInput {
  receipt_no: string;
  supplier_id: string | null;
  posting_date: string;
  notes?: string;
  items: ReceiptLineInput[];
}

export async function savePurchaseReceipt(input: PurchaseReceiptInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const receiptNo = input.receipt_no?.trim() || `PR-${Date.now().toString().slice(-8)}`;
  const { data: header, error: hErr } = await supabase
    .from("purchase_receipts")
    .insert({
      receipt_no: receiptNo,
      supplier_id: input.supplier_id || null,
      posting_date: input.posting_date || new Date().toISOString().slice(0, 10),
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("purchase_receipt_items").insert(
    lines.map((l) => ({
      receipt_id: header.id,
      product_id: l.product_id,
      qty: Number(l.qty),
      rate: Number(l.rate) || 0,
      warehouse_id: l.warehouse_id || null,
      batch_no: l.batch_no || null,
      expiry_date: l.expiry_date || null,
    }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/purchase-receipts");
  return { ok: true as const, receiptId: header.id };
}

export async function submitPurchaseReceiptForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_submit_purchase_receipt", { p_receipt_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/purchase-receipts");
  revalidatePath("/kits");
}

export async function cancelPurchaseReceiptForm(fd: FormData) {
  const supabase = createClient();
  await supabase.from("purchase_receipts").update({ status: "cancelled" }).eq("id", String(fd.get("id"))).eq("status", "draft");
  revalidatePath("/purchase-receipts");
}
