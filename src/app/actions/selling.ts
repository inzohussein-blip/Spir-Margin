"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface SOLineInput {
  product_id: string;
  qty: number;
  rate: number;
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
    }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/sales-orders");
  return { ok: true as const, salesOrderId: header.id };
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
