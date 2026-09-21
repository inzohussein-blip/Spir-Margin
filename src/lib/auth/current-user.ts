import "server-only";
import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  LOCAL_TRIAL_USER,
  verifySessionToken,
  type SessionUser,
} from "./session";
import { PLATFORM_MODE_COOKIE, resolvePlatform } from "./platform-mode";

/**
 * Current signed-in user (or null) for Server Components / Actions.
 *
 * On the local platform there is no sign-in step, so the local admin is
 * returned unconditionally. "Local platform" means either a
 * `SPIR_PLATFORM=local` build, or the hybrid build with the visitor's
 * `/welcome` choice set to local.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = cookies();
  if (resolvePlatform(jar.get(PLATFORM_MODE_COOKIE)?.value) === "local") {
    return LOCAL_TRIAL_USER;
  }
  return verifySessionToken(jar.get(SESSION_COOKIE)?.value);
}
