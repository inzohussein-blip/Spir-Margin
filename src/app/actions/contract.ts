"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function str(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  const s = v == null ? "" : String(v).trim();
  return s === "" ? null : s;
}

/** Create a service contract / AMC (ported from ERPNext "Contract"). */
export async function createContract(fd: FormData) {
  const supabase = createClient();
  const contract_no = str(fd, "contract_no");
  if (!contract_no) throw new Error("Contract no. is required");
  const { error } = await supabase.from("contracts").insert({
    contract_no,
    lab_id: str(fd, "lab_id"),
    device_id: str(fd, "device_id"),
    status: str(fd, "status") ?? "unsigned",
    start_date: str(fd, "start_date"),
    end_date: str(fd, "end_date"),
    contract_value: Number(str(fd, "contract_value") ?? "0"),
    signee: str(fd, "signee"),
    contract_terms: str(fd, "contract_terms"),
    billing_interval: str(fd, "billing_interval") ?? "none",
    service_product_id: str(fd, "service_product_id"),
    next_billing_date: str(fd, "next_billing_date"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
  redirect("/contracts");
}

/** Change a contract's status from the list. */
export async function setContractStatusForm(fd: FormData) {
  const supabase = createClient();
  const status = String(fd.get("status"));
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "active") patch.signed_on = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("contracts").update(patch).eq("id", String(fd.get("id")));
  if (error) throw new Error(error.message);
  revalidatePath("/contracts");
}
