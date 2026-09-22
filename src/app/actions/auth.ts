"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  BUILT_IN_USER,
  createSessionToken,
  type SessionUser,
} from "@/lib/auth/session";
import { lockoutRemaining, recordFailure, recordSuccess } from "@/lib/auth/rate-limit";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/demo-credentials";
import type { LoginState } from "@/lib/auth/login-state";

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE,
};

/** Only allow same-origin relative paths — never accept `//evil.com/...`. */
function safeNext(raw: string): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw === "/login" || raw.startsWith("/login/")) return "/";
  if (raw === "/welcome" || raw.startsWith("/welcome/")) return "/";
  return raw;
}

/**
 * Sign the session cookie for `user`. Returns null on success, or a
 * LoginState error when signing/setting the cookie fails — the caller then
 * surfaces the failure to the form instead of crashing into the error
 * boundary. `redirect()` is always called by the caller, never here, so
 * NEXT_REDIRECT throws cannot be caught inside this helper.
 */
async function trySetSession(user: SessionUser): Promise<LoginState> {
  try {
    const token = await createSessionToken(user);
    cookies().set(SESSION_COOKIE, token, cookieOptions);
    return null;
  } catch (e) {
    console.error("[auth] createSessionToken failed:", e);
    return { error: "Sign-in is unavailable right now" };
  }
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) return { error: "Enter your email and password" };

  // The built-in account is checked first, in code, before anything touches a
  // database. That is what makes sign-in work on a fresh install, with no
  // hosted database, and with no internet.
  if (email === DEMO_EMAIL && password === DEMO_PASSWORD) {
    const bad = await trySetSession(BUILT_IN_USER);
    if (bad) return bad;
    redirect(next);
  }

  // Any other email is a database-backed account in the local store. It has
  // its own rows, so this still works offline.
  const locked = await lockoutRemaining(email).catch(() => 0);
  if (locked > 0) {
    return { error: "Too many attempts. Try again later.", lockedFor: locked };
  }

  let data: SessionUser[] | null = null;
  try {
    const supabase = createClient();
    const res = await supabase.rpc("fn_verify_login", { p_email: email, p_password: password });
    if (res.error) {
      console.error("[auth] fn_verify_login error:", res.error);
      return { error: "Sign-in is unavailable right now" };
    }
    data = res.data as SessionUser[] | null;
  } catch (e) {
    console.error("[auth] fn_verify_login threw:", e);
    return { error: "Sign-in is unavailable right now" };
  }

  const row = data?.[0];
  if (!row) {
    await recordFailure(email).catch(() => undefined);
    return { error: "Invalid email or password" };
  }

  await recordSuccess(email).catch(() => undefined);
  const bad = await trySetSession(row);
  if (bad) return bad;
  redirect(next);
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
