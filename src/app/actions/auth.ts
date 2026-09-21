"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken, type SessionUser } from "@/lib/auth/session";
import { lockoutRemaining, recordFailure, recordSuccess } from "@/lib/auth/rate-limit";
import {
  PLATFORM_MODE_COOKIE,
  PLATFORM_MODE_MAX_AGE,
  parsePlatformMode,
  resolvePlatform,
  type PlatformMode,
} from "@/lib/auth/platform-mode";
import { LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_PASSWORD, LOCAL_ADMIN_ID } from "@/lib/auth/local-credentials";
import { CLOUD_ADMIN_EMAIL, CLOUD_ADMIN_PASSWORD, CLOUD_ADMIN_ID } from "@/lib/auth/cloud-credentials";
import { isCloudBuild, isLocalBuild } from "@/lib/runtime/platform";
import { isFullPlatformConfigured } from "@/lib/db/pglite";
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

const LOCAL_ADMIN_USER: SessionUser = {
  id: LOCAL_ADMIN_ID,
  email: LOCAL_ADMIN_EMAIL,
  full_name: "Administrator (Local trial)",
  role: "admin",
  lab_id: null,
};

const CLOUD_ADMIN_USER: SessionUser = {
  id: CLOUD_ADMIN_ID,
  email: CLOUD_ADMIN_EMAIL,
  full_name: "Administrator",
  role: "admin",
  lab_id: null,
};

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));

  if (!email || !password) return { error: "Enter your email and password" };

  // Which platform applies: the build flag, else the visitor's picker choice.
  const platform = resolvePlatform(cookies().get(PLATFORM_MODE_COOKIE)?.value);

  // --- LOCAL platform (trial) ----------------------------------------------
  // One fixed credential in code, no DB, no rate-limit, no bcrypt. Reaching
  // this at all is unusual: the local platform has no sign-in step, so
  // middleware normally redirects /login straight to `/`.
  if (platform === "local") {
    if (email !== LOCAL_ADMIN_EMAIL || password !== LOCAL_ADMIN_PASSWORD) {
      return { error: "Invalid email or password" };
    }
    const bad = await trySetSession(LOCAL_ADMIN_USER);
    if (bad) return bad;
    redirect(next);
  }

  // The full platform lives in a hosted Postgres. Without DATABASE_URL there
  // is no database to sign in to, and it must never borrow the trial's — so
  // stop here rather than handing out a session that every page then fails on.
  if (!isFullPlatformConfigured()) {
    return { error: "The full platform is not configured on this server yet." };
  }

  // --- NETWORKED platform (full, admin-only) -------------------------------
  // The fixed cloud admin in cloud-credentials.ts is the only accepted login.
  // It is checked before anything touches the database, so sign-in works even
  // when the hosted DB is unreachable.
  if (email === CLOUD_ADMIN_EMAIL && password === CLOUD_ADMIN_PASSWORD) {
    const bad = await trySetSession(CLOUD_ADMIN_USER);
    if (bad) return bad;
    redirect(next);
  }

  // The dedicated cloud build is admin-only and stops here. The hybrid build
  // additionally accepts DB-backed accounts so existing users can still be
  // exercised in development.
  if (isCloudBuild) {
    return { error: "Invalid email or password" };
  }

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
  const jar = cookies();
  jar.delete(SESSION_COOKIE);

  if (resolvePlatform(jar.get(PLATFORM_MODE_COOKIE)?.value) === "local") {
    // The local platform has no session to end. On the dedicated local build
    // there is nowhere else to go, so stay home. On the hybrid build, drop the
    // platform choice too — "sign out" is the way back to the picker.
    if (isLocalBuild) redirect("/");
    jar.delete(PLATFORM_MODE_COOKIE);
    redirect("/welcome");
  }

  redirect("/login");
}

/** Hybrid-build only: persist the visitor's platform choice before sign-in. */
export async function setPlatformModeAction(formData: FormData) {
  const mode: PlatformMode | null = parsePlatformMode(String(formData.get("mode") ?? ""));
  if (!mode) redirect("/welcome");
  // Selecting the full platform without a hosted database would strand the
  // visitor on a broken app; the picker disables that card, this enforces it.
  if (mode === "networked" && !isFullPlatformConfigured()) redirect("/welcome");
  cookies().set(PLATFORM_MODE_COOKIE, mode!, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PLATFORM_MODE_MAX_AGE,
  });
  // The local platform needs no sign-in, so go straight in.
  redirect(mode === "local" ? "/" : "/login");
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
