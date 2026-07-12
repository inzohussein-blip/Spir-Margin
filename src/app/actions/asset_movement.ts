"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface AssetMovementLineInput {
  device_id: string;
  target_lab_id?: string | null;
  target_warehouse_id?: string | null;
  to_custodian?: string;
}
export interface AssetMovementInput {
  movement_no: string;
  purpose: "issue" | "receipt" | "transfer";
  transaction_date: string;
  notes?: string;
  items: AssetMovementLineInput[];
}

/** Create a draft asset (device) movement with its device rows. */
export async function saveAssetMovement(input: AssetMovementInput) {
  const supabase = createClient();

  const lines = input.items.filter((l) => l.device_id);
  if (lines.length === 0) return { ok: false as const, error: "Add at least one device" };

  const { data: header, error: hErr } = await supabase
    .from("asset_movements")
    .insert({
      movement_no: input.movement_no || null,
      purpose: input.purpose,
      transaction_date: input.transaction_date
        ? new Date(input.transaction_date).toISOString()
        : new Date().toISOString(),
      notes: input.notes || null,
    })
    .select("id")
    .single();
  if (hErr) return { ok: false as const, error: hErr.message };

  const payload = lines.map((l) => ({
    movement_id: header.id,
    device_id: l.device_id,
    target_lab_id: l.target_lab_id || null,
    target_warehouse_id: l.target_warehouse_id || null,
    to_custodian: l.to_custodian || null,
  }));
  const { error: iErr } = await supabase.from("asset_movement_items").insert(payload);
  if (iErr) return { ok: false as const, error: iErr.message };

  revalidatePath("/asset-movements");
  return { ok: true as const, movementId: header.id };
}

/** Submit a movement: relocate each device and snapshot its source. */
export async function submitAssetMovement(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_submit_asset_movement", { p_movement_id: id });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/asset-movements");
  revalidatePath("/devices");
  return { ok: true as const, moved: data as number };
}

export async function cancelAssetMovement(id: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("asset_movements")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "draft");
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/asset-movements");
  return { ok: true as const };
}

export async function submitAssetMovementForm(fd: FormData) {
  await submitAssetMovement(String(fd.get("id")));
}
export async function cancelAssetMovementForm(fd: FormData) {
  await cancelAssetMovement(String(fd.get("id")));
}
