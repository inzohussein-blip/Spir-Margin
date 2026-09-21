import { isCloudBuild, isLocalBuild } from "@/lib/runtime/platform";

/**
 * Shared platform-mode constants and resolution.
 *
 * The cookie tracks which "platform" the visitor chose on `/welcome`:
 *
 *   - "local"     — this app runs entirely on this single computer (embedded
 *                   PGlite Postgres). No sign-in at all.
 *   - "networked" — the app talks to a hosted Postgres/Supabase database and
 *                   requires the fixed cloud admin credential.
 *
 * The picker only exists on the HYBRID build. A specialised build
 * (`SPIR_PLATFORM=local` / `=cloud`) is already one platform and ignores the
 * cookie entirely.
 *
 * This module has no runtime imports beyond the build flags, so the Edge
 * middleware can use it. The cookie-reading helpers live in
 * `./platform-mode-server`.
 */
export type PlatformMode = "local" | "networked";

export const PLATFORM_MODE_COOKIE = "spir_mode";
export const PLATFORM_MODE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/** Narrow a raw cookie value to a valid mode, or null when unset/garbage. */
export function parsePlatformMode(raw: string | undefined | null): PlatformMode | null {
  return raw === "local" || raw === "networked" ? raw : null;
}

/**
 * Which platform's behaviour applies to this request.
 *
 * A specialised build wins outright. On the hybrid build the visitor's
 * `/welcome` choice decides, so the deployed hybrid is a faithful preview of
 * BOTH products: picking "local" gives the trial's no-sign-in experience,
 * picking "networked" gives the full build's fixed-admin sign-in.
 *
 * Returns null only on the hybrid build before a choice has been made — the
 * caller should then send the visitor to `/welcome`.
 */
export function resolvePlatform(cookieValue: string | undefined | null): PlatformMode | null {
  if (isLocalBuild) return "local";
  if (isCloudBuild) return "networked";
  return parsePlatformMode(cookieValue);
}
