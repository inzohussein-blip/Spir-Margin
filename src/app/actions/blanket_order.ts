"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface BlanketLineInput {
  product_id: string;
  qty: number;
  rate: number;
}
export interface BlanketOrderInput {
  order_no: string;
  order_type: "selling" | "purchasing";
  lab_id: string | null;
  supplier_id: string | null;
  from_date: string;
  to_date: string;
  notes?: string;
  items: BlanketLineInput[];
}

export async function saveBlanketOrder(input: BlanketOrderInput) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const orderNo = input.order_no?.trim() || `BO-${Date.now().toString().slice(-8)}`;
  const { data: header, error: hErr } = await supabase
    .from("blanket_orders")
    .insert({
      order_no: orderNo,
      order_type: input.order_type,
      lab_id: input.order_type === "selling" ? input.lab_id || null : null,
      supplier_id: input.order_type === "purchasing" ? input.supplier_id || null : null,
      from_date: input.from_date || new Date().toISOString().slice(0, 10),
      to_date: input.to_date,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const { error: iErr } = await supabase.from("blanket_order_items").insert(
    lines.map((l) => ({
      order_id: header.id,
      product_id: l.product_id,
      qty: Number(l.qty),
      rate: Number(l.rate) || 0,
    }))
  );
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/blanket-orders");
  return { ok: true as const, orderId: header.id };
}

export async function submitBlanketOrderForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_submit_blanket_order", { p_order_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/blanket-orders");
}

export async function cancelBlanketOrderForm(fd: FormData) {
  const supabase = createClient();
  await supabase.from("blanket_orders").update({ status: "cancelled" }).eq("id", String(fd.get("id"))).neq("status", "cancelled");
  revalidatePath("/blanket-orders");
}
