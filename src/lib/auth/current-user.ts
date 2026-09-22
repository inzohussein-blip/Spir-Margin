import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./session";

/** Current signed-in user (or null) for Server Components and Server Actions. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
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
