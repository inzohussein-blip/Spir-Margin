"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Raise draft purchase orders for everything currently below its reorder level
 * (Odoo-style reordering rules). Delegates to fn_generate_reorder_pos(), which
 * groups by supplier and skips products already on an open PO, so it is safe to
 * run repeatedly.
 */
export async function generateReorderPos() {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_generate_reorder_pos");
  if (error) throw new Error(error.message);
  const count = Number(data) || 0;
  revalidatePath("/reorder");
  revalidatePath("/purchase-orders");
  redirect(`/reorder?created=${count}`);
}
