"use server";

import { createClient } from "@/lib/supabase/server";
import { getStaffUser } from "@/lib/auth/current-user";
import { localDate } from "@/lib/dates";
import { nextBatches, type BatchRow, type KitHint } from "@/lib/kits";

/** For each kit in stock: the batch a sale takes from next (see src/lib/kits.ts). */
export async function kitHintsAction(): Promise<Record<string, KitHint>> {
  if (!(await getStaffUser())) return {};
  const { data } = await createClient()
    .from("kit_batches")
    .select("product_id, batch_no, expiry_date, qty_available, created_at")
    .gt("qty_available", 0);
  return nextBatches(((data as unknown as BatchRow[]) ?? []), localDate());
}
