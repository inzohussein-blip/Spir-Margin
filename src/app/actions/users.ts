"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { forgetSessions } from "@/lib/auth/revocation";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function createUserAction(_prev: unknown, formData: FormData) {
  if (!(await requireAdmin())) return { error: "Admins only" };
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const full_name = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "staff");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  const supabase = createClient();
  // fn_create_user quietly returns the existing account for a known email, so
  // without this the form would report success and change nothing.
  const { data: existing } = await supabase.from("app_users").select("id").eq("email", email).maybeSingle();
  if (existing) return { error: "That email already exists" };
  const { error } = await supabase.rpc("fn_create_user", {
    p_email: email, p_password: password, p_full_name: full_name || null, p_role: role,
  });
  if (error) return { error: error.message.includes("unique") ? "That email already exists" : "Could not create user" };
  revalidatePath("/users");
  return { ok: true as const, message: "User created" };
}

export async function setUserActiveAction(formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return;
  const id = String(formData.get("id"));
  if (id === admin.id) return; // an administrator cannot lock themself out
  const active = String(formData.get("active")) === "true";
  const supabase = createClient();
  await supabase.from("app_users").update({ is_active: active }).eq("id", id);
  // Disabling ends that person's open sessions on their next click.
  forgetSessions();
  revalidatePath("/users");
}

/**
 * For someone who forgot their password: an administrator sets a new one and
 * hands it over. Their sessions everywhere end (migration 0103), so this is
 * also what to do when a password may have leaked.
 *
 * No revalidatePath: nothing in the list changes, and re-rendering the page
 * would remount the form and take the confirmation away with it.
 */
export async function resetUserPasswordAction(_prev: unknown, formData: FormData) {
  const admin = await requireAdmin();
  if (!admin) return { error: "Admins only" };
  const id = String(formData.get("id") ?? "");
  const password = String(formData.get("password") ?? "");
  // One's own password is changed from My account, where the current one is asked for.
  if (id === admin.id) return { error: "Change your own password from My account" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  const supabase = createClient();
  const { data: target } = await supabase.from("app_users").select("id").eq("id", id).maybeSingle();
  if (!target) return { error: "This user no longer exists" };
  const { error } = await supabase.rpc("fn_set_password", { p_user_id: id, p_password: password });
  if (error) return { error: "Could not reset password" };
  forgetSessions();
  return { ok: true as const, message: "Password reset. Give it to its owner; their open sessions have been signed out." };
}
