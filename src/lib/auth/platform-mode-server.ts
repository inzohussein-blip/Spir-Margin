import "server-only";
import type { PlatformMode } from "./platform-mode";

/**
 * Which platform this deployment naturally is, used by `/welcome` to mark one
 * of the two cards "Recommended". Resolution of the ACTIVE platform lives in
 * `resolvePlatform()` in `./platform-mode` — it works in the Edge middleware
 * too, so it has no `next/headers` dependency.
 */
export function inferPlatformMode(): PlatformMode {
  return process.env.DATABASE_URL ? "networked" : "local";
}
