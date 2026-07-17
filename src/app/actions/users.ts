"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

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
  const { error } = await supabase.rpc("fn_create_user", {
    p_email: email, p_password: password, p_full_name: full_name || null, p_role: role,
  });
  if (error) return { error: error.message.includes("unique") ? "That email already exists" : "Could not create user" };
  revalidatePath("/users");
  return { ok: true as const, message: `User ${email} created` };
}

export async function setUserActiveAction(formData: FormData) {
  if (!(await requireAdmin())) return;
  const id = String(formData.get("id"));
  const active = String(formData.get("active")) === "true";
  const supabase = createClient();
  await supabase.from("app_users").update({ is_active: active }).eq("id", id);
  revalidatePath("/users");
}

export async function resetUserPasswordAction(_prev: unknown, formData: FormData) {
  if (!(await requireAdmin())) return { error: "Admins only" };
  const id = String(formData.get("id"));
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  const supabase = createClient();
  const { error } = await supabase.rpc("fn_set_password", { p_user_id: id, p_password: password });
  if (error) return { error: "Could not reset password" };
  revalidatePath("/users");
  return { ok: true as const, message: "Password reset" };
}
