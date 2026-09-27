"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { assertFeature } from "@/lib/features";
import { formError } from "@/lib/db/form-error";
import { localDate } from "@/lib/dates";
import { getCurrentUser } from "@/lib/auth/current-user";
import { FREQS, SLOTS, UNIT_KINDS, type Freq, type UnitKind } from "@/lib/coldchain/core";

/** Cold chain & calibration (migration 0118). */

const FEATURE = "Cold chain";

function str(fd: FormData, key: string): string | null {
  const v = fd.get(key);
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}
const ymd = (v: string | null) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const numOrNull = (v: string | null) => (v == null || !Number.isFinite(Number(v)) ? null : Number(v));
const who = async () => (await getCurrentUser().catch(() => null))?.full_name ?? null;

// ── Storage units ────────────────────────────────────────────────────────────
export async function createUnit(fd: FormData) {
  await assertFeature(FEATURE);
  const name = str(fd, "name");
  const kind = (str(fd, "kind") ?? "fridge") as UnitKind;
  const min = numOrNull(str(fd, "min_temp"));
  const max = numOrNull(str(fd, "max_temp"));
  if (!name || !UNIT_KINDS.includes(kind) || min == null || max == null) return { error: "Enter the name and the safe range" };
  if (max <= min) return { error: "The highest temperature must be above the lowest" };
  const { error } = await createClient().from("cc_storage_units").insert({
    name, kind, min_temp: min, max_temp: max, warehouse_id: str(fd, "warehouse_id"), notes: str(fd, "notes"),
  });
  if (error) return formError(error);
  revalidatePath("/cold-chain/units");
  redirect("/cold-chain/units?saved=created");
}

export async function toggleUnit(fd: FormData) {
  await assertFeature(FEATURE);
  const id = str(fd, "id");
  if (!id) return { error: "Nothing to change" };
  const { error } = await createClient().from("cc_storage_units")
    .update({ is_active: str(fd, "active") === "1", updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return formError(error);
  revalidatePath("/cold-chain/units");
  redirect("/cold-chain/units?saved=updated");
}

// ── Readings ─────────────────────────────────────────────────────────────────
/** The day's sheet: every unit's morning and evening reading, and what was done about one out of range. */
export async function saveReadings(fd: FormData) {
  await assertFeature(FEATURE);
  const date = ymd(str(fd, "date")) ?? localDate();
  const units = fd.getAll("unit").map(String).filter(Boolean);
  const supabase = createClient();
  const by = await who();
  for (const u of units) {
    for (const s of SLOTS) {
      const raw = str(fd, `v:${u}:${s}`);
      const before = str(fd, `was:${u}:${s}`);
      const action = str(fd, `a:${u}:${s}`);
      const beforeAction = str(fd, `wasa:${u}:${s}`);
      if (raw === before && action === beforeAction) continue; // untouched
      const value = raw == null ? null : Number(raw.replace(",", "."));
      if (raw != null && !Number.isFinite(value)) return { error: "Write the temperature as a number, e.g. 4.5" };
      const { error } = await supabase.rpc("fn_cc_set_reading", { p_unit: u, p_date: date, p_slot: s, p_value: value, p_by: by, p_action: action });
      if (error) return formError(error);
    }
  }
  revalidatePath("/cold-chain/temperatures");
  redirect(`/cold-chain/temperatures${date === localDate() ? "" : `?date=${date}`}${date === localDate() ? "?" : "&"}saved=updated`);
}

// ── Instruments ──────────────────────────────────────────────────────────────
export async function createEquipment(fd: FormData) {
  await assertFeature(FEATURE);
  const name = str(fd, "name");
  if (!name) return { error: "Enter the instrument's name" };
  const months = numOrNull(str(fd, "calib_months"));
  const { data, error } = await createClient().from("cc_equipment").insert({
    name, model: str(fd, "model"), serial_no: str(fd, "serial_no"), location: str(fd, "location"),
    vendor: str(fd, "vendor"), vendor_phone: str(fd, "vendor_phone"), installed_on: ymd(str(fd, "installed_on")),
    calib_months: months && months >= 1 ? Math.round(months) : null, last_calibrated: ymd(str(fd, "last_calibrated")), notes: str(fd, "notes"),
  }).select("id").single();
  if (error) return formError(error);
  revalidatePath("/cold-chain/equipment");
  redirect(`/cold-chain/equipment/${(data as { id: string }).id}?saved=created`);
}

export async function addTask(fd: FormData) {
  await assertFeature(FEATURE);
  const equipment = str(fd, "equipment_id");
  const name = str(fd, "name");
  const freq = (str(fd, "freq") ?? "weekly") as Freq;
  if (!equipment || !name || !FREQS.includes(freq)) return { error: "Enter the task and how often it is done" };
  const { error } = await createClient().from("cc_equipment_tasks").insert({ equipment_id: equipment, name, freq });
  if (error) return formError(error);
  revalidatePath(`/cold-chain/equipment/${equipment}`);
  redirect(`/cold-chain/equipment/${equipment}?saved=created`);
}

export async function taskDone(fd: FormData) {
  await assertFeature(FEATURE);
  const id = str(fd, "id");
  const equipment = str(fd, "equipment_id");
  if (!id || !equipment) return { error: "Nothing to change" };
  const { error } = await createClient().from("cc_equipment_tasks").update({ last_done: localDate(), updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return formError(error);
  revalidatePath(`/cold-chain/equipment/${equipment}`);
  revalidatePath("/cold-chain/equipment");
  redirect(`/cold-chain/equipment/${equipment}?saved=updated`);
}

export async function deleteTask(fd: FormData) {
  await assertFeature(FEATURE);
  const id = str(fd, "id");
  const equipment = str(fd, "equipment_id");
  if (!id || !equipment) return { error: "Nothing to delete" };
  const { error } = await createClient().from("cc_equipment_tasks").delete().eq("id", id);
  if (error) return formError(error);
  revalidatePath(`/cold-chain/equipment/${equipment}`);
  redirect(`/cold-chain/equipment/${equipment}?saved=deleted`);
}

export async function addLog(fd: FormData) {
  await assertFeature(FEATURE);
  const equipment = str(fd, "equipment_id");
  const type = str(fd, "log_type");
  const details = str(fd, "details");
  if (!equipment || !details || !["maintenance", "fault", "calibration"].includes(type ?? "")) return { error: "Choose the kind of entry and describe it" };
  const hours = numOrNull(str(fd, "downtime_hours"));
  const { error } = await createClient().from("cc_equipment_log").insert({
    equipment_id: equipment, log_type: type, details, action: str(fd, "action"),
    log_date: ymd(str(fd, "log_date")) ?? localDate(), downtime_hours: hours != null && hours >= 0 ? hours : null,
    resolved: type !== "fault" || fd.get("resolved") != null, recorded_by: await who(),
  });
  if (error) return formError(error);
  revalidatePath(`/cold-chain/equipment/${equipment}`);
  revalidatePath("/cold-chain/equipment");
  redirect(`/cold-chain/equipment/${equipment}?saved=created`);
}
