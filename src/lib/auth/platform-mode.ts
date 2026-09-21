import "server-only";
import { cookies } from "next/headers";

/**
 * Which "platform" the user chose before signing in:
 *
 *   - "local"     — this app runs entirely on this single computer (embedded
 *                   PGlite Postgres). Accounts and passwords live only on this
 *                   machine and cannot be used from another device.
 *   - "networked" — the app talks to a hosted Postgres/Supabase database, so
 *                   the same account works from any authorized computer.
 *
 * The choice is only a UX signal: the actual data store is decided at the
 * server by `DATABASE_URL` (see `src/lib/supabase/server.ts`). The cookie lets
 * the login page tailor its explanatory note and lets us funnel a first-time
 * visitor through `/welcome` before showing the sign-in form.
 */
export type PlatformMode = "local" | "networked";

export const PLATFORM_MODE_COOKIE = "spir_mode";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year

export function getPlatformMode(): PlatformMode | null {
  const v = cookies().get(PLATFORM_MODE_COOKIE)?.value;
  return v === "local" || v === "networked" ? v : null;
}

/** The mode the current deployment naturally is (used when the cookie is stale). */
export function inferPlatformMode(): PlatformMode {
  return process.env.DATABASE_URL ? "networked" : "local";
}

export const PLATFORM_MODE_MAX_AGE = MAX_AGE_SECONDS;
