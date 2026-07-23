"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface PosLine {
  product_id: string;
  qty: number;
  /** Client-side display only — the server always re-reads the authoritative cost. */
  buy_price?: number;
  sell_price: number;
}

/**
 * Complete a Point-of-Sale transaction, booking one `sales` row per cart line
 * so it flows straight into revenue/profit reporting.
 *
 * `requestId` is a client-generated UUID that makes the checkout idempotent:
 * the offline outbox reuses the same id when it replays a queued sale, so a
 * retry after a lost response can never double-post. All money-integrity rules
 * live in fn_pos_checkout (migration 0073) and run in a single transaction —
 * the customer and products must exist, products must be enabled, and the COST
 * is always re-read from the product, never trusted from the client.
 */
export async function createPosSale(labId: string, lines: PosLine[], requestId?: string) {
  const clean = lines.filter((l) => l.product_id && Number(l.qty) > 0);
  if (!labId) return { ok: false as const, error: "Select a customer (lab)." };
  if (clean.length === 0) return { ok: false as const, error: "Cart is empty." };
  if (clean.some((l) => Number(l.sell_price) < 0)) {
    return { ok: false as const, error: "Sell price cannot be negative." };
  }

  const supabase = createClient();
  const payload = clean.map((l) => ({
    product_id: l.product_id,
    qty: Number(l.qty),
    sell_price: Number(l.sell_price) || 0,
  }));

  const { data, error } = await supabase.rpc("fn_pos_checkout", {
    p_request_id: requestId || randomUUID(),
    p_lab_id: labId,
    p_lines: JSON.stringify(payload),
  });
  if (error) return { ok: false as const, error: error.message };

  const row = (data as { n_lines: number; total_amount: number }[] | null)?.[0];
  revalidatePath("/");
  revalidatePath("/sales");
  return { ok: true as const, count: Number(row?.n_lines ?? 0), total: Number(row?.total_amount ?? 0) };
}
