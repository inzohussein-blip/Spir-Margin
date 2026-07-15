"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

/** Create a pricing rule (ported from ERPNext "Pricing Rule"). */
export async function createPricingRule(fd: FormData) {
  const supabase = createClient();
  const title = str(fd, "title");
  if (!title) throw new Error("Title is required");
  const { error } = await supabase.from("pricing_rules").insert({
    title,
    product_id: str(fd, "product_id"),
    lab_id: str(fd, "lab_id"),
    min_qty: Number(str(fd, "min_qty") ?? "0"),
    max_qty: str(fd, "max_qty") ? Number(str(fd, "max_qty")) : null,
    discount_percentage: Number(str(fd, "discount_percentage") ?? "0"),
    valid_from: str(fd, "valid_from"),
    valid_upto: str(fd, "valid_upto"),
    priority: Number(str(fd, "priority") ?? "0"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/pricing-rules");
  redirect("/pricing-rules");
}

export async function togglePricingRuleForm(fd: FormData) {
  const supabase = createClient();
  await supabase
    .from("pricing_rules")
    .update({ disabled: fd.get("disabled") === "true" })
    .eq("id", String(fd.get("id")));
  revalidatePath("/pricing-rules");
}

export async function deletePricingRuleForm(fd: FormData) {
  const supabase = createClient();
  await supabase.from("pricing_rules").delete().eq("id", String(fd.get("id")));
  revalidatePath("/pricing-rules");
}
