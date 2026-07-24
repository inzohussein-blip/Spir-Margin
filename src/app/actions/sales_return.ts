"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ReturnLineInput { product_id: string; qty: number; sell_price: number; }
export interface SalesReturnInput {
  lab_id: string;
  posting_date?: string;
  reason?: string;
  notes?: string;
  items: ReturnLineInput[];
}

/** Book a sales return (credit note). Idempotent on an optional request id so
 *  an offline/replayed submit never double-refunds or double-restocks. The
 *  restock + reversing GL happen atomically inside fn_book_sales_return. */
export async function saveSalesReturn(input: SalesReturnInput, requestId?: string) {
  const supabase = createClient();
  const lines = input.items.filter((l) => l.product_id && Number(l.qty) > 0);
  if (!input.lab_id) return { ok: false as const, error: "Pick a lab" };
  if (lines.length === 0) return { ok: false as const, error: "Add at least one line" };

  const { data, error } = await supabase.rpc("fn_book_sales_return", {
    p_request_id: requestId || randomUUID(),
    p_lab_id: input.lab_id,
    p_posting_date: input.posting_date || "",
    p_reason: input.reason || "",
    p_notes: input.notes || "",
    p_lines: JSON.stringify(lines.map((l) => ({
      product_id: l.product_id,
      qty: Number(l.qty),
      sell_price: Number(l.sell_price) || 0,
    }))),
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/sales-returns");
  revalidatePath("/sales-invoices");
  return { ok: true as const, returnId: data as string };
}
