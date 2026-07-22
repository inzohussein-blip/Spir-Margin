"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PosLine {
  product_id: string;
  qty: number;
  /** Client-side display only — the server always re-reads the authoritative cost. */
  buy_price: number;
  sell_price: number;
}

/**
 * Complete a Point-of-Sale transaction: record one sales row per cart line
 * (the same `sales` model the profit dashboard reads), so a POS sale flows
 * straight into revenue/profit reporting.
 *
 * Money-integrity rules (this path books real revenue, so it never trusts the
 * client blindly):
 *   - The customer must exist.
 *   - Every product must exist and be enabled.
 *   - The COST (buy_price) is always re-read from products.default_buy_price —
 *     the client cannot forge it, so profit/cost accounting stays correct.
 *   - Quantities must be > 0 and sell prices must be >= 0.
 *   - All lines are inserted in one atomic multi-row insert (all or nothing).
 */
export async function createPosSale(labId: string, lines: PosLine[]) {
  if (!labId) return { ok: false as const, error: "Select a customer (lab)." };
  const clean = lines.filter((l) => l.product_id && Number(l.qty) > 0);
  if (clean.length === 0) return { ok: false as const, error: "Cart is empty." };
  if (clean.some((l) => Number(l.sell_price) < 0)) {
    return { ok: false as const, error: "Sell price cannot be negative." };
  }

  const supabase = createClient();

  // Customer must exist.
  const { data: lab } = await supabase.from("labs").select("id").eq("id", labId).single();
  if (!lab) return { ok: false as const, error: "Customer not found." };

  // Authoritative product data — cost is never taken from the client.
  interface ProdRow { id: string; default_buy_price: number; is_disabled: boolean }
  const ids = [...new Set(clean.map((l) => l.product_id))];
  const { data: prods } = await supabase
    .from("products")
    .select("id, default_buy_price, is_disabled")
    .in("id", ids);
  const byId = new Map(((prods as ProdRow[] | null) ?? []).map((p) => [p.id, p]));
  for (const l of clean) {
    const p = byId.get(l.product_id);
    if (!p) return { ok: false as const, error: "A product in the cart no longer exists." };
    if (p.is_disabled) return { ok: false as const, error: "A product in the cart is disabled." };
  }

  const rows = clean.map((l) => ({
    lab_id: labId,
    product_id: l.product_id,
    qty: Number(l.qty),
    buy_price: Number(byId.get(l.product_id)!.default_buy_price) || 0, // authoritative cost
    sell_price: Number(l.sell_price) || 0,
  }));
  const { error } = await supabase.from("sales").insert(rows);
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/");
  revalidatePath("/sales");
  const total = rows.reduce((s, r) => s + r.qty * r.sell_price, 0);
  return { ok: true as const, count: rows.length, total };
}
