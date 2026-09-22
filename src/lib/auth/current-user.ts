import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "./session";

/** Current signed-in user (or null) for Server Components and Server Actions. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}
