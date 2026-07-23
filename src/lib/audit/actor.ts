import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * Records "who" for the immutable audit trail. The audit trigger reads
 * current_setting('app.actor'); this sets it to the signed-in user's email for
 * the duration of a mutating statement, so every edit and deletion in
 * Monitoring → Change & Deletion Log is attributed to a person.
 *
 * Only the embedded PGlite backend is handled: it is a single connection and
 * we serialize the "set actor + run" pair here, so there is no interleave. On
 * pooled Postgres (DATABASE_URL) a session GUC could leak onto the next request
 * sharing that connection, so we deliberately skip it (actor stays null) rather
 * than risk mis-attribution.
 */

interface DbLike {
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
}

// Global promise chain so mutations that carry an actor run one-at-a-time.
let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.then(() => undefined, () => undefined);
  return next as Promise<T>;
}

async function currentActor(): Promise<string | null> {
  try {
    const token = cookies().get(SESSION_COOKIE)?.value;
    const user = await verifySessionToken(token);
    return user?.email ?? null;
  } catch {
    // Called outside a request scope (e.g. a background task) — no actor.
    return null;
  }
}

/** Run a mutating DB call with the acting user's email set for the audit trigger. */
export async function withAuditActor<T>(db: DbLike, run: () => Promise<T>): Promise<T> {
  if (process.env.DATABASE_URL) return run(); // pooled backend — skip (see note above)
  const actor = await currentActor();
  if (!actor) return run();
  return serialize(async () => {
    await db.query("select set_config('app.actor', $1, false)", [actor]);
    return run();
  });
}
