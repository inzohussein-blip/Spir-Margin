import "server-only";
import { cookies } from "next/headers";
import { createPgRestClient } from "@/lib/db/rest";
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from "@/lib/auth/session";
import { isSessionCurrent } from "@/lib/auth/revocation";

/**
 * Data clients for Server Components, Server Actions and route handlers.
 *
 * There is one datastore: the embedded database on this machine. A hosted
 * database, when configured, is reached only by the sync engine — never by a
 * page or an action — so nothing here can fail because the network is down.
 *
 * The returned object exposes the small supabase-js surface the app uses
 * (`.from(...).select()/insert()/update()/delete()`, filters, `.rpc()`), so
 * pages and actions are unchanged.
 *
 * WHO MAY ASK. Middleware keeps signed-out visitors off every page, but it
 * cannot stop a Server Action: an action is a POST that names the action by
 * id, and it runs on whatever page it is posted to — including /login, which
 * has to be public. Checking inside each of ~60 action files is how that was
 * handled before, and 44 of them did not. So the check lives here, in the one
 * place every query passes through, and a new action is protected without
 * anyone remembering to protect it:
 *
 *   createClient()        staff — any signed-in user except a portal customer
 *   createUserClient()    any signed-in user, portal customers included
 *   createPortalClient()  portal customers only
 *   createPublicClient()  no session needed — sign-in itself, and error
 *                         reporting from pages a signed-out visitor can see.
 *                         Every use of it is a deliberate, reviewed exception.
 */

type Audience = "staff" | "user" | "portal";

/** Raised when a query is refused; surfaces to callers as an `error` result. */
export class AccessDenied extends Error {
  constructor(message = "Sign in to continue") {
    super(message);
    this.name = "AccessDenied";
  }
}

/**
 * The signed-in user, or "background" when the code is not serving an HTTP
 * request at all (nothing outside this process can reach that path).
 */
async function requester(): Promise<SessionUser | null | "background"> {
  let token: string | undefined;
  try {
    token = cookies().get(SESSION_COOKIE)?.value;
  } catch (e) {
    // Only a genuine "no request" is background work. Anything else — notably
    // Next's own signal that a page is being rendered dynamically — must keep
    // propagating, or the framework's rendering decisions would change.
    if (e instanceof Error && /outside a request scope/i.test(e.message)) return "background";
    throw e;
  }
  const user = await verifySessionToken(token);
  // A genuine cookie for a reset password or a disabled account is refused
  // here too, so an action posted from a page that is already open fails.
  return user && (await isSessionCurrent(user)) ? user : null;
}

function guardFor(audience: Audience) {
  return async () => {
    const user = await requester();
    if (user === "background") return;
    if (!user) throw new AccessDenied();
    if (audience === "staff" && user.role === "customer") {
      throw new AccessDenied("Not available from the customer portal");
    }
    if (audience === "portal" && user.role !== "customer") {
      throw new AccessDenied("Portal data is for portal accounts");
    }
  };
}

/** Staff data access. The default for every page and action. */
export function createClient() {
  return createPgRestClient(guardFor("staff"));
}

/** Any signed-in user — e.g. changing one's own password. */
export function createUserClient() {
  return createPgRestClient(guardFor("user"));
}

/** Portal customers only; callers still scope every query to the session's lab. */
export function createPortalClient() {
  return createPgRestClient(guardFor("portal"));
}

/**
 * No session required. Only for sign-in and for recording errors from pages a
 * signed-out visitor can reach — never for reading business data.
 */
export function createPublicClient() {
  return createPgRestClient();
}
