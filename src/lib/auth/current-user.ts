import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./session";
import { isSessionCurrent } from "./revocation";

/**
 * The session behind this request. `ended` means the cookie is genuine but no
 * longer counts — the password was reset or the account disabled since.
 */
export async function readSession(): Promise<{ user: SessionUser | null; ended: boolean }> {
  const user = await verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
  if (!user) return { user: null, ended: false };
  if (await isSessionCurrent(user)) return { user, ended: false };
  return { user: null, ended: true };
}

/** Current signed-in user (or null) for Server Components and Server Actions. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await readSession()).user;
}

/**
 * The signed-in staff user, or null for a visitor or a portal customer. For
 * actions that reach the database directly rather than through createClient()
 * (which applies the same rule itself).
 */
export async function getStaffUser(): Promise<SessionUser | null> {
  const user = await getCurrentUser();
  return user && user.role !== "customer" ? user : null;
}
