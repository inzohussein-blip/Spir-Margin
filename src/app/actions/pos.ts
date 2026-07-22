"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PosLine {
  product_id: string;
  qty: number;
  buy_price: number;
  sell_price: number;
}

/**
 * Complete a Point-of-Sale transaction: record one sales row per cart line
 * (the same `sales` model the profit dashboard reads), so a POS sale flows
 * straight into revenue/profit reporting. Returns a plain result object; the
 * terminal stays on the page and clears its cart on success.
 */
export async function createPosSale(labId: string, lines: PosLine[]) {
  if (!labId) return { ok: false as const, error: "Select a customer (lab)." };
  const clean = lines.filter((l) => l.product_id && Number(l.qty) > 0);
  if (clean.length === 0) return { ok: false as const, error: "Cart is empty." };

  const supabase = createClient();
  const rows = clean.map((l) => ({
    lab_id: labId,
    product_id: l.product_id,
    qty: Number(l.qty),
    buy_price: Number(l.buy_price) || 0,
    sell_price: Number(l.sell_price) || 0,
  }));
  const { error } = await supabase.from("sales").insert(rows);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/");
  revalidatePath("/sales");
  const total = rows.reduce((s, r) => s + r.qty * r.sell_price, 0);
  return { ok: true as const, count: rows.length, total };
}
