"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
function req(fd: FormData, k: string): string {
  const s = str(fd, k);
  if (s == null) throw new Error(`Field "${k}" is required`);
  return s;
}

/** Create an opportunity (ported from ERPNext "Opportunity"). */
export async function createOpportunity(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("opportunities").insert({
    title: req(fd, "title"),
    lab_id: str(fd, "lab_id"),
    lead_id: str(fd, "lead_id"),
    status: str(fd, "status") ?? "open",
    opportunity_type: str(fd, "opportunity_type"),
    sales_stage: str(fd, "sales_stage") ?? "Prospecting",
    opportunity_amount: Number(str(fd, "opportunity_amount") ?? "0"),
    probability: Number(str(fd, "probability") ?? "0"),
    expected_closing: str(fd, "expected_closing"),
    territory: str(fd, "territory"),
    contact_email: str(fd, "contact_email"),
    contact_mobile: str(fd, "contact_mobile"),
    notes: str(fd, "notes"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/opportunities");
  redirect("/opportunities");
}

export async function setOpportunityStatusForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase
    .from("opportunities")
    .update({ status: String(fd.get("status")), updated_at: new Date().toISOString() })
    .eq("id", String(fd.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/opportunities");
}
