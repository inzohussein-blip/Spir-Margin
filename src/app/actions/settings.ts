"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { CORE_FEATURES, TOGGLEABLE_FEATURES, type FeatureState } from "@/lib/features";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

const STATES: FeatureState[] = ["enabled", "disabled", "hidden"];

/** Set the global state of a non-core feature (enabled | disabled | hidden). */
export async function setFeatureStateAction(fd: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const feature = String(fd.get("feature") ?? "");
  const state = String(fd.get("state") ?? "") as FeatureState;
  if (!TOGGLEABLE_FEATURES.includes(feature) || CORE_FEATURES.has(feature)) return;
  if (!STATES.includes(state)) return;

  const supabase = createClient();
  if (state === "enabled") {
    // Enabled is the default — clear any stored override to keep the table lean.
    await supabase.from("feature_flags").delete().eq("feature", feature);
  } else {
    // Upsert: try update, insert if it didn't exist.
    const { data } = await supabase.from("feature_flags").update({ state, updated_at: new Date().toISOString() }).eq("feature", feature).select("feature");
    if (!data || (data as unknown[]).length === 0) {
      await supabase.from("feature_flags").insert({ feature, state });
    }
  }
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

/** Allow or deny a specific account access to a feature (presence of a row = denied). */
export async function setUserAccessAction(fd: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const userId = String(fd.get("user_id") ?? "");
  const feature = String(fd.get("feature") ?? "");
  const deny = String(fd.get("deny") ?? "") === "true";
  if (!userId || CORE_FEATURES.has(feature)) return;

  const supabase = createClient();
  // Never restrict an admin account (they always retain full access).
  const { data: target } = await supabase.from("app_users").select("role").eq("id", userId).single();
  if (!target || (target as { role: string }).role === "admin") return;

  if (deny) {
    const { data } = await supabase.from("user_feature_access").select("feature").eq("user_id", userId).eq("feature", feature);
    if (!data || (data as unknown[]).length === 0) {
      await supabase.from("user_feature_access").insert({ user_id: userId, feature });
    }
  } else {
    await supabase.from("user_feature_access").delete().eq("user_id", userId).eq("feature", feature);
  }
  revalidatePath("/settings");
}

/**
 * Permanently delete an account. Defensive guards (never yourself, never the
 * last admin) protect data integrity even though the UI only ever offers this
 * for non-admin accounts.
 */
export async function deleteUserAccountAction(fd: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const userId = String(fd.get("user_id") ?? "");
  if (!userId || userId === admin.id) return;

  const supabase = createClient();
  const { data: target } = await supabase.from("app_users").select("role").eq("id", userId).single();
  if (!target) return;

  if ((target as { role: string }).role === "admin") {
    const { data: admins } = await supabase.from("app_users").select("id").eq("role", "admin");
    if (((admins as { id: string }[] | null)?.length ?? 0) <= 1) return; // keep the last admin
  }

  await supabase.from("app_users").delete().eq("id", userId);
  revalidatePath("/settings");
  revalidatePath("/users");
}
