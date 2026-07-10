"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * المرحلة الثالثة — Business Logic (Server Actions)
 *
 * 1. recordSale        : record a sale and return computed profit
 *    (profit = (sell_price - buy_price) * qty).
 * 2. getKitMargin      : difference between buy price (from parent company)
 *    and sell price (to the lab) for a given kit batch.
 * 3. recordWithdrawal  : register a lab pulling kits; a DB trigger decrements
 *    batch stock and stamps the lab active.
 * 4. refreshLabStatuses: mark labs active/inactive based on withdrawal
 *    activity within the given window.
 */

export interface SaleInput {
  labId: string;
  productId: string;
  kitBatchId?: string;
  qty: number;
  buyPrice: number;
  sellPrice: number;
}

export async function recordSale(input: SaleInput) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("sales")
    .insert({
      lab_id: input.labId,
      product_id: input.productId,
      kit_batch_id: input.kitBatchId ?? null,
      qty: input.qty,
      buy_price: input.buyPrice,
      sell_price: input.sellPrice,
    })
    .select("id, profit")
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/");
  return { ok: true as const, saleId: data.id, profit: data.profit as number };
}

/** Margin between parent-company buy price and lab sell price for a kit. */
export async function getKitMargin(batchId: string) {
  const supabase = createClient();

  const { data, error } = await supabase
    .rpc("fn_kit_margin", { p_batch_id: batchId })
    .single();

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, margin: data };
}

export interface WithdrawalInput {
  kitBatchId: string;
  labId: string;
  qty: number;
  buyPrice: number;
  sellPrice: number;
  note?: string;
}

export async function recordWithdrawal(input: WithdrawalInput) {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("stock_movements")
    .insert({
      kit_batch_id: input.kitBatchId,
      lab_id: input.labId,
      type: "withdrawal",
      qty: input.qty,
      buy_price: input.buyPrice,
      sell_price: input.sellPrice,
      note: input.note ?? null,
    })
    .select("id")
    .single();

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/");
  revalidatePath("/labs");
  return { ok: true as const, movementId: data.id };
}

/**
 * Update every lab's active/inactive flag based on recent withdrawal
 * activity. Delegates to the SQL function fn_refresh_lab_status so the
 * rule lives in one place.
 */
export async function refreshLabStatuses(inactiveAfterDays = 60) {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("fn_refresh_lab_status", {
    p_lab_id: null,
    p_days: inactiveAfterDays,
  });

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/labs");
  return { ok: true as const, labsUpdated: data as number };
}
