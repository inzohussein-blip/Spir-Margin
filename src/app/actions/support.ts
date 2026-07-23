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
    billed_to: str(fd, "billed_to") ?? "agent",
    charge_amount: Number(str(fd, "charge_amount") ?? "0") || 0,
    insurer_name: str(fd, "insurer_name"),
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

/** Create a support issue (ported from ERPNext "Issue"). */
export async function createIssue(fd: FormData) {
  const supabase = createClient();
  const subject = str(fd, "subject");
  if (!subject) throw new Error("Subject is required");
  const { error } = await supabase.from("issues").insert({
    issue_no: str(fd, "issue_no"),
    subject,
    lab_id: str(fd, "lab_id"),
    device_id: str(fd, "device_id"),
    raised_by: str(fd, "raised_by"),
    priority: str(fd, "priority"),
    issue_type: str(fd, "issue_type"),
    description: str(fd, "description"),
    opening_date: str(fd, "opening_date") ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/issues");
  redirect("/issues");
}

/** Change an issue's status from the list (stamps resolved_on when closed out). */
export async function setIssueStatusForm(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_set_issue_status", {
    p_id: String(fd.get("id")),
    p_status: String(fd.get("status")),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/issues");
}

/** Save resolution details on an issue (from the detail page). */
export async function resolveIssueForm(fd: FormData) {
  const supabase = createClient();
  const id = String(fd.get("id"));
  await supabase
    .from("issues")
    .update({ resolution_details: str(fd, "resolution_details"), updated_at: new Date().toISOString() })
    .eq("id", id);
  await supabase.rpc("fn_set_issue_status", { p_id: id, p_status: "resolved" });
  revalidatePath("/issues");
  redirect("/issues");
}
