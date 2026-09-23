import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/lib/db/pglite";
import { DEMO_PASSWORD } from "./demo-credentials";

/**
 * The built-in account's password (migration 0109).
 *
 * Until an administrator sets one, it is DEMO_PASSWORD (123), as printed on
 * the sign-in page. Once set, only its bcrypt hash is kept, in a table of
 * this computer's own that never syncs.
 *
 * Forgotten? Anyone who can reach the program's folder on this computer can
 * put back the original: create an empty file named RESET-ADMIN-PASSWORD (or
 * RESET-ADMIN-PASSWORD.txt, as Notepad saves it) in that folder, and sign in
 * with 123. The file is removed once used. Physical access to the computer
 * already means access to its data, so this gives nobody anything new.
 */

const RESET_FILES = ["RESET-ADMIN-PASSWORD", "RESET-ADMIN-PASSWORD.txt"];

/** Clear a set password if a reset file is waiting. Returns whether it did. */
export async function consumeResetFile(): Promise<boolean> {
  const found = RESET_FILES.map((f) => path.join(process.cwd(), f)).filter((f) => fs.existsSync(f));
  if (!found.length) return false;
  const { db } = await getDb();
  await db.query(`update _spir_builtin set password_hash = null, changed_at = now()`);
  for (const f of found) fs.rmSync(f, { force: true });
  console.warn("[auth] the built-in account's password was reset to the original by a reset file");
  return true;
}

/** Whether an administrator has replaced the original password. */
export async function builtinPasswordChanged(): Promise<boolean> {
  try {
    const { db } = await getDb();
    const r = await db.query<{ set: boolean }>(`select password_hash is not null as set from _spir_builtin`);
    return !!r.rows[0]?.set;
  } catch {
    return false;
  }
}

export async function builtinPasswordMatches(password: string): Promise<boolean> {
  await consumeResetFile().catch(() => false);
  const { db } = await getDb();
  const r = await db.query<{ hash: string | null; ok: boolean | null }>(
    `select password_hash as hash,
            case when password_hash is null then null else password_hash = crypt($1, password_hash) end as ok
       from _spir_builtin`,
    [password],
  );
  const row = r.rows[0];
  if (!row || row.hash === null) return password === DEMO_PASSWORD;
  return row.ok === true;
}

export async function setBuiltinPassword(password: string): Promise<void> {
  const { db } = await getDb();
  await db.query(
    `update _spir_builtin set password_hash = crypt($1, gen_salt('bf')), changed_at = now()`,
    [password],
  );
}

/** When the password last changed: sessions signed before then have ended. */
export async function builtinChangedAt(): Promise<string | null> {
  const { db } = await getDb();
  const r = await db.query<{ at: string | null }>(`select changed_at as at from _spir_builtin`);
  return r.rows[0]?.at ?? null;
}
