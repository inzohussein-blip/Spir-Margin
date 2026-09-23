"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getCurrentUser } from "@/lib/auth/current-user";
import { builtinPasswordMatches, setBuiltinPassword } from "@/lib/auth/builtin";
import { forgetSessions } from "@/lib/auth/revocation";
import { BUILT_IN_USER, SESSION_COOKIE, SESSION_MAX_AGE, createSessionToken } from "@/lib/auth/session";

export interface BuiltinState {
  error?: string;
}

/**
 * Settings → Built-in account: replace 123 with a password of the company's
 * own. Any administrator may do it, knowing the current one. Every session
 * of the built-in account elsewhere ends; if it is the one doing this, it
 * stays signed in here.
 */
export async function setBuiltinPasswordAction(_prev: BuiltinState | null, formData: FormData): Promise<BuiltinState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Only an admin can change this" };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const again = String(formData.get("again") ?? "");
  if (next.length < 8) return { error: "New password must be at least 8 characters" };
  if (next !== again) return { error: "The two new passwords do not match" };
  if (next === "123") return { error: "Choose a password other than 123" };
  if (!(await builtinPasswordMatches(current))) return { error: "Current password is incorrect" };

  await setBuiltinPassword(next);
  forgetSessions();
  if (user.id === BUILT_IN_USER.id) {
    cookies().set(SESSION_COOKIE, await createSessionToken(BUILT_IN_USER), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
  }
  redirect("/settings?builtin=changed#builtin");
}
