"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SOLineInput {
  product_id: string;
  qty: number;
  rate: number;
  serial_no?: string | null;
}
export interface SalesOrderInput {
  lab_id: string;
  transaction_date: string;
  delivery_date?: string | null;
  notes?: string;
  items: SOLineInput[];
}

export async function saveSalesOrder(input: SalesOrderInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (!input.lab_id) return { ok: false as const, error: "Pick a lab" };
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data: header, error: hErr } = await supabase
    .from("sales_orders")
    .insert({
      lab_id: input.lab_id,
      transaction_date: input.transaction_date || new Date().toISOString().slice(0, 10),
      delivery_date: input.delivery_date || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("sales_order_items").insert(
    lines.map((l) => ({
      sales_order_id: header.id,
      product_id: l.product_id,
      qty: Number(l.qty),
      rate: Number(l.rate) || 0,
      serial_no: l.serial_no?.trim() || null,
    }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/sales-orders");
  return { ok: true as const, salesOrderId: header.id };
}

/**
 * Update a DRAFT sales order in place: header fields + a full replace of the
 * line items. Only draft orders are editable — once delivered the order has
 * posted sales, so it is locked. Every change is captured by the audit trigger
 * (migration 0075) and shows in Monitoring → Change & Deletion Log.
 */
export async function updateSalesOrder(id: string, input: SalesOrderInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (!input.lab_id) return { ok: false as const, error: "Pick a lab" };
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  // Guard: only a draft order may be edited.
  const { data: existing } = await supabase.from("sales_orders").select("status").eq("id", id).single();
  if (!existing) return { ok: false as const, error: "Order not found" };
  if ((existing as { status: string }).status !== "draft") {
    return { ok: false as const, error: "Only draft orders can be edited" };
  }

  const { error: hErr } = await supabase
    .from("sales_orders")
    .update({
      lab_id: input.lab_id,
      transaction_date: input.transaction_date || new Date().toISOString().slice(0, 10),
      delivery_date: input.delivery_date || null,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "draft");
  if (hErr) return { ok: false as const, error: hErr.message };

  // Replace the lines.
  await supabase.from("sales_order_items").delete().eq("sales_order_id", id);
  const { error: iErr } = await supabase.from("sales_order_items").insert(
    lines.map((l) => ({
      sales_order_id: id,
      product_id: l.product_id,
      qty: Number(l.qty),
      rate: Number(l.rate) || 0,
      serial_no: l.serial_no?.trim() || null,
    }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/sales-orders");
  revalidatePath(`/sales-orders/${id}`);
  return { ok: true as const, salesOrderId: id };
}

/** Delete a draft or cancelled sales order (items cascade). Delivered orders
 *  are protected because they have already posted sales. */
export async function deleteSalesOrderForm(fd: FormData) {
  const supabase = createClient();
  const id = String(fd.get("id"));
  const { error } = await supabase
    .from("sales_orders")
    .delete()
    .eq("id", id)
    .in("status", ["draft", "cancelled"]);
  if (error) throw new Error(error.message);
  revalidatePath("/sales-orders");
}

export async function deliverSalesOrderForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_deliver_sales_order", {
    p_so_id: String(fd.get("id")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/sales-orders");
  revalidatePath("/");
}

export async function cancelSalesOrderForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("sales_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", String(fd.get("id")))
    .eq("status", "draft");
  if (error) throw new Error(error.message);
  revalidatePath("/sales-orders");
}
