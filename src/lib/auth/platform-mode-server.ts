import "server-only";
import { cookies } from "next/headers";
import { PLATFORM_MODE_COOKIE, type PlatformMode } from "./platform-mode";

/** Server-only helpers for the platform-mode cookie (see `./platform-mode`). */

export function getPlatformMode(): PlatformMode | null {
  const v = cookies().get(PLATFORM_MODE_COOKIE)?.value;
  return v === "local" || v === "networked" ? v : null;
}

/** The mode the current deployment naturally is (used when the cookie is stale). */
export function inferPlatformMode(): PlatformMode {
  return process.env.DATABASE_URL ? "networked" : "local";
}
