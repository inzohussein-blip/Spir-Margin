import "server-only";
import { getDb } from "@/lib/db/pglite";
import { DEMO_USER_ID } from "./demo-credentials";
import type { SessionUser } from "./session";

/**
 * Whether a correctly signed session still counts.
 *
 * The signature only proves the server issued the cookie; it cannot know what
 * happened to the user since. So the user's row decides: the account must
 * still exist and be active, and the session must not predate the last
 * password set (`sessions_valid_after`, migration 0103). Resetting a password
 * or disabling an account therefore ends that person's open sessions.
 *
 * The middleware runs where the database is not reachable, so this is checked
 * on the server — by getCurrentUser() and by the data guard in
 * supabase/server.ts, which between them cover every page and every action.
 */

// Every query a page makes passes the guard, so a page asks the same question
// many times over. The answer is kept briefly, and forgotten the moment an
// administrator changes an account (forgetSessions), so a reset or a disable
// still takes effect on the very next click.
const TTL_MS = 5_000;
const MAX = 200;
const recent = new Map<string, { ok: boolean; at: number }>();

export function forgetSessions(): void {
  recent.clear();
}

export async function isSessionCurrent(user: SessionUser): Promise<boolean> {
  // The built-in account lives in the source, not in the table.
  if (user.id === DEMO_USER_ID) return true;

  const key = `${user.id}:${user.issued_at ?? 0}`;
  const hit = recent.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ok;

  let ok: boolean;
  try {
    const { db } = await getDb();
    // A token signed in second S was issued somewhere inside [S, S+1). It is
    // older than the cut-off only if that whole second is; a session issued in
    // the same second as the password change (the browser that changed its
    // own password gets a fresh one) keeps working.
    const { rows } = await db.query<{ ok: boolean }>(
      `select is_active
              and (sessions_valid_after is null
                   or sessions_valid_after < to_timestamp($2::double precision + 1)) as ok
         from app_users
        where id::text = $1`,
      [user.id, user.issued_at ?? 0],
    );
    ok = rows[0]?.ok === true;
  } catch (e) {
    // The database is unreachable, so no data can be served either way;
    // signing everyone out on top of that would only turn a pause into a
    // wave of logins. The next request asks again.
    console.error("[auth] could not check the session:", e);
    return true;
  }

  if (recent.size >= MAX) recent.clear();
  recent.set(key, { ok, at: Date.now() });
  return ok;
}

/**
 * With a hosted database, the cut-off can arrive from another computer whose
 * clock runs ahead of this one. Every session signed here would then look
 * older than it, and end the moment it began — until this clock caught up.
 * A successful sign-in proves the person knows the current password, so a
 * cut-off still in the future is brought back to now.
 */
export async function settleFutureCutoff(userId: string): Promise<void> {
  if (userId === DEMO_USER_ID) return;
  try {
    const { db } = await getDb();
    await db.query(
      `update app_users set sessions_valid_after = now()
        where id::text = $1 and sessions_valid_after > now()`,
      [userId],
    );
  } catch (e) {
    console.error("[auth] could not settle the session cut-off:", e);
  }
}
