import "server-only";
import { createPgRestClient } from "@/lib/db/rest";

/**
 * Data client for Server Components and Server Actions.
 *
 * There is one datastore: the embedded database on this machine. A hosted
 * database, when configured, is reached only by the sync engine — never by a
 * page or an action — so nothing here can fail because the network is down.
 *
 * The returned object exposes the small supabase-js surface the app uses
 * (`.from(...).select()/insert()/update()/delete()`, filters, `.rpc()`), so
 * pages and actions are unchanged.
 */
export function createClient() {
  return createPgRestClient();
}
