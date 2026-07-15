"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Set a lab's credit limit (ported from ERPNext "Customer Credit Limit"). */
export async function setLabCreditLimitForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("labs")
    .update({ credit_limit: Number(fd.get("credit_limit") || 0) })
    .eq("id", String(fd.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/credit-limits");
  revalidatePath("/labs");
}
