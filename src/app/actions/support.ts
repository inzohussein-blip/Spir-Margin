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

/** Create a warranty claim (ported from ERPNext "Warranty Claim"). */
export async function createWarrantyClaim(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("warranty_claims").insert({
    status: str(fd, "status") ?? "open",
    complaint_date: str(fd, "complaint_date") ?? new Date().toISOString().slice(0, 10),
    serial_number_id: str(fd, "serial_number_id"),
    device_id: str(fd, "device_id"),
    product_id: str(fd, "product_id"),
    lab_id: str(fd, "lab_id"),
    complaint: str(fd, "complaint"),
    warranty_amc_status: str(fd, "warranty_amc_status"),
    complaint_raised_by: str(fd, "complaint_raised_by"),
    contact_mobile: str(fd, "contact_mobile"),
    contact_email: str(fd, "contact_email"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/warranty");
  redirect("/warranty");
}

/** Resolve/close a claim from the list. */
export async function resolveWarrantyClaimForm(fd: FormData) {
  const supabase = createClient();
  const id = String(fd.get("id"));
  const { error } = await supabase
    .from("warranty_claims")
    .update({
      status: "closed",
      resolution_date: new Date().toISOString(),
      resolution_details: str(fd, "resolution_details"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/warranty");
}
