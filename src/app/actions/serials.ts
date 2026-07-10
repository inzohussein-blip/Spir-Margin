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

/** Create a serial number (ported from ERPNext "Serial No"). */
export async function createSerialNumber(fd: FormData) {
  const supabase = createClient();
  const { error } = await supabase.from("serial_numbers").insert({
    serial_no: req(fd, "serial_no"),
    product_id: req(fd, "product_id"),
    status: str(fd, "status") ?? "active",
    maintenance_status: str(fd, "maintenance_status"),
    warehouse_id: str(fd, "warehouse_id"),
    lab_id: str(fd, "lab_id"),
    batch_no: str(fd, "batch_no"),
    purchase_rate: Number(str(fd, "purchase_rate") ?? "0"),
    warranty_period_days: str(fd, "warranty_period_days")
      ? Number(str(fd, "warranty_period_days"))
      : null,
    warranty_expiry_date: str(fd, "warranty_expiry_date"),
    amc_expiry_date: str(fd, "amc_expiry_date"),
    description: str(fd, "description"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/serials");
  redirect("/serials");
}
