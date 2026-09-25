"use server";

import { formError } from "@/lib/db/form-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { localDate } from "@/lib/dates";

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
    failure_date: s(fd, "failure_date") ?? localDate(),
    description: s(fd, "description"),
    actions_performed: s(fd, "actions_performed"),
    downtime: s(fd, "downtime"),
    repair_cost: Number(s(fd, "repair_cost") ?? "0"),
  });
  if (error) return formError(error);
  revalidatePath("/asset-repairs");
  revalidatePath("/devices");
  redirect("/asset-repairs?saved=created");
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
  const res = await completeAssetRepair(String(fd.get("id")));
  if (!res.ok) return { error: res.error ?? "Could not save" };
}
export async function cancelAssetRepairForm(fd: FormData) {
  const res = await cancelAssetRepair(String(fd.get("id")));
  if (!res.ok) return { error: res.error ?? "Could not save" };
}
