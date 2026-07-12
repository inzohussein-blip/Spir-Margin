"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function s(fd: FormData, k: string): string | null {
  const v = fd.get(k);
  const t = v == null ? "" : String(v).trim();
  return t === "" ? null : t;
}

/** Create an asset repair (device is taken out of service by a DB trigger). */
export async function createAssetRepair(fd: FormData) {
  const supabase = createClient();
  const device_id = s(fd, "device_id");
  if (!device_id) throw new Error("Device is required");
  const { error } = await supabase.from("asset_repairs").insert({
    repair_no: s(fd, "repair_no"),
    device_id,
    failure_date: s(fd, "failure_date") ?? new Date().toISOString().slice(0, 10),
    description: s(fd, "description"),
    actions_performed: s(fd, "actions_performed"),
    downtime: s(fd, "downtime"),
    repair_cost: Number(s(fd, "repair_cost") ?? "0"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/asset-repairs");
  revalidatePath("/devices");
  redirect("/asset-repairs");
}

/** Complete a repair: log it and return the device to service. */
export async function completeAssetRepair(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_complete_asset_repair", { p_repair_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/asset-repairs");
  revalidatePath("/devices");
  return { ok: true as const };
}

export async function cancelAssetRepair(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("asset_repairs")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pending");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/asset-repairs");
  return { ok: true as const };
}

export async function completeAssetRepairForm(fd: FormData) {
  await completeAssetRepair(String(fd.get("id")));
}
export async function cancelAssetRepairForm(fd: FormData) {
  await cancelAssetRepair(String(fd.get("id")));
}
