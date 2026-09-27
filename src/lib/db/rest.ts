import "server-only";
import { getDb } from "./pglite";
import { withAuditActor } from "@/lib/audit/actor";
import { describeDbError } from "./errors";
import { PgRestClient, plainDbError, type Db, type DbError } from "./rest-core";

/**
 * The server's data client: the query builder (rest-core.ts) on this
 * computer's database, with the access guard before every query, the acting
 * person recorded on every write, constraint messages in Arabic, and failed
 * reads reported.
 */

export type { DbError } from "./rest-core";

/** Keep the Postgres diagnostics that `new Error(...)` would throw away. */
function dbError(e: unknown): DbError {
  const err = plainDbError(e);
  // A constraint the row broke (23xxx: duplicate, still referenced, required,
  // out of range) is said in Arabic here, once, because many actions hand
  // error.message straight to the screen. Callers that branch on the kind of
  // failure use `code`, which is kept.
  // Only a named constraint: a function's own `raise … using errcode =
  // 'check_violation'` ("not enough stock: 3 available, 5 needed") already
  // says it better than a general sentence would.
  if (err.code?.startsWith("23") && (err.constraint || err.code === "23502")) err.message = describeDbError("ar", err) ?? err.message;
  return err;
}

/**
 * Most pages read with `const { data } = await …` and show an empty list when
 * data is null — so a read that fails (a missing column after a botched
 * update, a broken view) would look like "no records yet". Every failed read
 * is therefore written to the server log and to the Error Monitor
 * (app_errors), at most once a minute per table and error code.
 */
type ErrG = { __spirReadErrors?: Map<string, number> };
async function noteFailedRead(db: Db, table: string, err: DbError) {
  try {
    const seen = ((globalThis as ErrG).__spirReadErrors ??= new Map());
    const key = `${table}|${err.code ?? ""}`;
    const now = Date.now();
    if (now - (seen.get(key) ?? 0) < 60_000) return;
    seen.set(key, now);
    console.error(`[db] read of ${table} failed:`, err.code ?? "", err.message);
    await db.query(
      `insert into app_errors (severity, source, message, detail) values ('error', 'server', $1, $2)`,
      [`Reading ${table} failed`.slice(0, 2000), `${err.code ?? ""} ${err.message}`.slice(0, 8000)],
    );
  } catch {
    /* the monitor must never add a failure of its own */
  }
}

/**
 * Build a data client over the working store. `guard` runs before every query
 * and throws to refuse it — see `@/lib/supabase/server` for who may ask what.
 */
export function createPgRestClient(guard?: () => Promise<void>) {
  return new PgRestClient({
    open: getDb,
    guard,
    error: dbError,
    write: (db, run) => withAuditActor(db, run),
    failedRead: (db, table, err) => void noteFailedRead(db, table, err),
  });
}

export type { PgRestClient };
