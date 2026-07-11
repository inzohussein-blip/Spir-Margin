"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createAccount(fd: FormData) {
  const supabase = createClient();
  const name = String(fd.get("account_name") || "").trim();
  if (!name) throw new Error('Field "account_name" is required');
  const { error } = await supabase.from("accounts").insert({
    account_name: name,
    account_number: (String(fd.get("account_number") || "").trim() || null),
    root_type: String(fd.get("root_type") || "asset"),
    account_type: (String(fd.get("account_type") || "").trim() || null),
    parent_account: (String(fd.get("parent_account") || "").trim() || null),
    is_group: fd.get("is_group") != null,
    currency: String(fd.get("currency") || "USD"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/accounts");
  redirect("/accounts");
}
