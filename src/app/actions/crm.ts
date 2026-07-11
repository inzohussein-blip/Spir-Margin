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

/** Create a lead (ported from ERPNext "Lead"). */
export async function createLead(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("leads").insert({
    lead_name: req(fd, "lead_name"),
    company_name: str(fd, "company_name"),
    status: str(fd, "status") ?? "lead",
    email: str(fd, "email"),
    phone: str(fd, "phone"),
    mobile_no: str(fd, "mobile_no"),
    territory: str(fd, "territory"),
    industry: str(fd, "industry"),
    city: str(fd, "city"),
    country: str(fd, "country"),
    source: str(fd, "source"),
    notes: str(fd, "notes"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  redirect("/leads");
}

/** Convert a lead into an active lab. */
export async function convertLeadForm(fd: FormData) {
  const supabase = createClient();
  const code = "LAB-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  const { error } = await supabase.rpc("fn_convert_lead", {
    p_lead_id: String(fd.get("id")),
    p_code: code,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/leads");
  revalidatePath("/labs");
}
