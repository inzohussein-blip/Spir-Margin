"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function num(fd: FormData, k: string): number {
  return Number(fd.get(k) ?? 0) || 0;
}
function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

/** Create a landed-cost voucher against a received purchase receipt. */
export async function createLandedCost(fd: FormData) {
  const supabase = createClient();
  const receipt_id = str(fd, "receipt_id");
  if (!receipt_id) throw new Error("Select a purchase receipt");
  const voucher_no = str(fd, "voucher_no") ?? `LC-${Date.now()}`;
  const { error } = await supabase.from("landed_cost_vouchers").insert({
    voucher_no,
    receipt_id,
    freight: num(fd, "freight"),
    customs: num(fd, "customs"),
    clearance: num(fd, "clearance"),
    other: num(fd, "other"),
    allocation_method: str(fd, "allocation_method") ?? "by_value",
    notes: str(fd, "notes"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/landed-costs");
  redirect("/landed-costs");
}

/** Apply a draft voucher: spread its cost across the receipt's batches. */
export async function applyLandedCostForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_apply_landed_cost", { p_voucher_id: String(fd.get("id")) });
  if (error) throw new Error(error.message);
  revalidatePath("/landed-costs");
  revalidatePath("/stock-balance");
}
