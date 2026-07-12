"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface BomLineInput {
  component_id: string;
  qty: number;
  rate: number;
  uom?: string;
  source_warehouse?: string;
}
export interface BomInput {
  bom_no: string;
  product_id: string;
  quantity: number;
  uom?: string;
  is_active?: boolean;
  is_default?: boolean;
  description?: string;
  items: BomLineInput[];
}

/** Create a Bill of Materials with its component rows. */
export async function saveBom(input: BomInput) {
  const supabase = createClient();

  const lines = input.items.filter((l) => l.component_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one component" };
  if (!input.product_id) return { ok: false as const, error: "Finished product is required" };

  const { data: header, error: hErr } = await supabase
    .from("boms")
    .insert({
      bom_no: input.bom_no || null,
      product_id: input.product_id,
      quantity: Number(input.quantity) || 1,
      uom: input.uom || null,
      is_active: input.is_active ?? true,
      is_default: input.is_default ?? false,
      description: input.description || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = lines.map((l) => ({
    bom_id: header.id,
    component_id: l.component_id,
    qty: Number(l.qty),
    rate: Number(l.rate) || 0,
    uom: l.uom || null,
    source_warehouse: l.source_warehouse || null,
  }));
  const { error: iErr } = await supabase.from("bom_items").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/boms");
  return { ok: true as const, bomId: header.id };
}

export interface WorkOrderInput {
  wo_no: string;
  product_id: string;
  bom_id?: string | null;
  qty: number;
  fg_warehouse?: string | null;
  planned_start?: string | null;
  planned_end?: string | null;
  notes?: string;
}

/** Create a draft work order. */
export async function saveWorkOrder(input: WorkOrderInput) {
  const supabase = createClient();
  if (!input.product_id) return { ok: false as const, error: "Finished product is required" };

  const { data, error } = await supabase
    .from("work_orders")
    .insert({
      wo_no: input.wo_no || null,
      product_id: input.product_id,
      bom_id: input.bom_id || null,
      qty: Number(input.qty) || 1,
      fg_warehouse: input.fg_warehouse || null,
      planned_start: input.planned_start || null,
      planned_end: input.planned_end || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/work-orders");
  return { ok: true as const, workOrderId: data.id };
}

/** Complete a work order: produces a kit batch of the finished product. */
export async function completeWorkOrder(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_complete_work_order", { p_wo_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/work-orders");
  revalidatePath("/kits");
  return { ok: true as const, batchId: data as string };
}

export async function cancelWorkOrder(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("work_orders")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["draft", "in_process"]);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/work-orders");
  return { ok: true as const };
}

/** FormData variant used by the "New work order" page form. */
export async function createWorkOrder(fd: FormData) {
  const s = (k: string) => {
    const v = fd.get(k);
    const t = v == null ? "" : String(v).trim();
    return t === "" ? null : t;
  };
  const res = await saveWorkOrder({
    wo_no: s("wo_no") ?? "",
    product_id: s("product_id") ?? "",
    bom_id: s("bom_id"),
    qty: Number(s("qty") ?? "1"),
    fg_warehouse: s("fg_warehouse"),
    planned_start: s("planned_start"),
    planned_end: s("planned_end"),
    notes: s("notes") ?? "",
  });
  if (!res.ok) throw new Error(res.error);
  redirect("/work-orders");
}

/** FormData wrappers for inline <form action={…}> buttons. */
export async function completeWorkOrderForm(fd: FormData) {
  await completeWorkOrder(String(fd.get("id")));
}
export async function cancelWorkOrderForm(fd: FormData) {
  await cancelWorkOrder(String(fd.get("id")));
}
