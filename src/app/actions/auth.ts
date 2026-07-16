"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, type SessionUser } from "@/lib/auth/session";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

export async function loginAction(_prev: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password" };

  const supabase = createClient();
  const { data, error } = await supabase.rpc("fn_verify_login", { p_email: email, p_password: password });
  if (error) return { error: "Sign-in is unavailable right now" };
  const row = (data as SessionUser[] | null)?.[0];
  if (!row) return { error: "Invalid email or password" };

  const token = await createSessionToken(row);
  cookies().set(SESSION_COOKIE, token, cookieOptions);
  redirect("/");
}

export async function logoutAction() {
  cookies().delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePasswordAction(_prev: unknown, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };

  const current = String(formData.get("current_password") ?? "");
  const next = String(formData.get("new_password") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters" };

  const supabase = createClient();
  const { data } = await supabase.rpc("fn_verify_login", { p_email: user.email, p_password: current });
  if (!((data as unknown[] | null)?.length)) return { error: "Current password is incorrect" };

  const { error } = await supabase.rpc("fn_set_password", { p_user_id: user.id, p_password: next });
  if (error) return { error: "Could not update password" };
  return { ok: true as const, message: "Password updated" };
}
