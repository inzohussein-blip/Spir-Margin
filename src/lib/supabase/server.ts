import "server-only";
import { cookies } from "next/headers";
import { createPgRestClient } from "@/lib/db/rest";
import type { DbTarget } from "@/lib/db/pglite";
import { PLATFORM_MODE_COOKIE, resolvePlatform } from "@/lib/auth/platform-mode";

/**
 * Data client for Server Components and Server Actions.
 *
 * The two platforms have completely separate datastores and this is where the
 * request is routed to one of them:
 *
 *   trial platform → embedded PGlite, seeded from `supabase/seed-trial.sql`.
 *   full platform  → hosted Postgres over DATABASE_URL.
 *
 * Neither ever falls back to the other, so trial data can never leak into a
 * real deployment and a missing DATABASE_URL can never be papered over with
 * the demo database.
 *
 * The returned object exposes the small supabase-js surface the app uses
 * (`.from(...).select()/insert()/update()/delete()`, filters, `.rpc()`), so
 * pages and actions are unchanged.
 */
export function createClient() {
  return createPgRestClient(currentDbTarget());
}

/** Which platform's datastore this request belongs to. */
export function currentDbTarget(): DbTarget {
  return resolvePlatform(cookies().get(PLATFORM_MODE_COOKIE)?.value) === "local"
    ? "trial"
    : "full";
}
