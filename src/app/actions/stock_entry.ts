"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface StockEntryLineInput {
  batch_id: string;
  qty: number;
  rate?: number;
}
export interface StockEntryInput {
  entry_no: string;
  purpose: "receipt" | "issue" | "transfer";
  posting_date: string;
  from_warehouse?: string | null;
  to_warehouse?: string | null;
  notes?: string;
  items: StockEntryLineInput[];
}

/** Create a draft stock entry with its batch rows. */
export async function saveStockEntry(input: StockEntryInput) {
  const supabase = createClient();

  const lines = input.items.filter((l) => l.batch_id && Number(l.qty) > 0);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one batch row" };

  const { data: header, error: hErr } = await supabase
    .from("stock_entries")
    .insert({
      entry_no: input.entry_no || null,
      purpose: input.purpose,
      posting_date: input.posting_date || new Date().toISOString().slice(0, 10),
      from_warehouse: input.from_warehouse || null,
      to_warehouse: input.to_warehouse || null,
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = lines.map((l) => ({
    entry_id: header.id,
    batch_id: l.batch_id,
    qty: Number(l.qty),
    rate: Number(l.rate) || 0,
  }));
  const { error: iErr } = await supabase.from("stock_entry_items").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/stock-entries");
  return { ok: true as const, entryId: header.id };
}

/** Submit a stock entry: applies each row against its batch. */
export async function submitStockEntry(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_submit_stock_entry", { p_entry_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/stock-entries");
  revalidatePath("/kits");
  return { ok: true as const, applied: data as number };
}

export async function cancelStockEntry(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("stock_entries")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/stock-entries");
  return { ok: true as const };
}

export async function submitStockEntryForm(fd: FormData) {
  await submitStockEntry(String(fd.get("id")));
}
export async function cancelStockEntryForm(fd: FormData) {
  await cancelStockEntry(String(fd.get("id")));
}
