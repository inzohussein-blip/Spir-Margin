import { createPgRestClient } from "@/lib/db/rest";

/**
 * Data client for Server Components and Server Actions.
 *
 * Backed by an embedded Postgres (PGlite) that runs this project's own SQL
 * migrations and plpgsql functions in-process — no external Supabase needed.
 * The returned object exposes the small supabase-js surface the app uses
 * (`.from(...).select()/insert()/update()/delete()`, filters, `.rpc()`), so
 * pages and actions work unchanged.
 */
export function createClient() {
  return createPgRestClient();
}
