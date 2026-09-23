"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getDb,
  remoteUrl,
  remoteUrlIsFromEnvironment,
  resetRemoteDb,
  restoreLocalDatabase,
  setRemoteUrl,
  isTransactionPooler,
} from "@/lib/db/pglite";
import { adoptClone, hasOwnWork, nodeId } from "@/lib/sync/core";
import { decodeSyncCode, encodeSyncCode, type LanCode } from "@/lib/sync/code";
import { runSync } from "@/lib/sync/engine";
import {
  applyServerSetting,
  fetchClone,
  hello,
  mainComputerCode,
  newSecret,
  readServerSetting,
  schemaVersion,
  UnreachableError,
  WrongCodeError,
} from "@/lib/sync/lan";

/**
 * Linking computers (the Sync page).
 *
 * A computer has at most one upstream: the main computer on the office
 * network, or the hosted database. Pasting a sync code picks one, and
 * replaces the other. Everything here is for administrators only: a sync
 * code is a key to all of the company's records.
 */

export interface LinkState {
  error?: string;
  detail?: string;
  ok?: boolean;
  message?: string;
  /** A code to show (on request only). */
  code?: string;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

function done(message: string): LinkState {
  revalidatePath("/sync");
  return { ok: true, message };
}

/** Test a Postgres address before relying on it. */
async function probe(url: string): Promise<string | null> {
  const pgLib = (await import("pg")).default as typeof import("pg");
  const client = new pgLib.Client({
    connectionString: url,
    ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    return null;
  } catch (e) {
    return (e as Error).message;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function linkHosted(url: string): Promise<LinkState> {
  if (isTransactionPooler(url)) {
    return { error: "This address goes through the transaction pooler (port 6543), which this program cannot use. In Supabase choose the Session pooler (port 5432) or the Direct connection." };
  }
  const failure = await probe(url);
  if (failure) return { error: "Could not connect. Check the address and the password, and that this computer is online.", detail: failure };
  await setRemoteUrl(url);
  const { db } = await getDb();
  await db.query(`update _spir_peer set lan_code = null`);
  void runSync();
  return done("Linked to the hosted database. Syncing has started.");
}

async function linkMain(raw: string, code: LanCode): Promise<LinkState> {
  const { db } = await getDb();
  const me = await nodeId(db);
  if (code.n === me) return { error: "This is the main computer's own code. Paste it on the other computers." };

  let peer;
  try {
    peer = await hello(code, me);
  } catch (e) {
    if (e instanceof WrongCodeError) {
      return { error: "The main computer did not accept this code. It may have been changed there — copy the current one." };
    }
    return {
      error: "The main computer could not be reached. Check that it is on, that the program is running on it, that both computers are on the same network, and that Windows Firewall on it allows Node.js.",
      detail: e instanceof UnreachableError ? e.message : (e as Error).message,
    };
  }

  const mine = await schemaVersion(db);
  if (peer.schema !== mine) {
    return {
      error: "The two computers run different versions of Spir-Margin. Update both to the same version, then link again.",
      detail: `${peer.schema} ≠ ${mine}`,
    };
  }

  if (!(await hasOwnWork(db))) {
    // Nothing here yet: start from a full copy of the main computer, which
    // carries everything — including records older than its change log.
    const dump = await fetchClone(code, me);
    await restoreLocalDatabase(dump);
    const { db: restored } = await getDb();
    await adoptClone(restored, "lan");
    await restored.query(`update _spir_peer set lan_code = $1, database_url = null`, [raw]);
    resetRemoteDb();
    void runSync();
    return done("Linked. This computer now has a full copy of the main computer's records, and keeps in step with it.");
  }

  // This computer already has work of its own: merge the two, both ways.
  await db.query(`update _spir_peer set lan_code = $1, database_url = null`, [raw]);
  await db.query(`delete from _spir_sync_state where peer = 'lan'`);
  resetRemoteDb();
  const res = await runSync();
  if (!res.ok) return { ok: true, message: "Linked, but the first sync did not finish. It will keep trying.", detail: res.error };
  return done("Linked. This computer's records and the main computer's have been merged.");
}

/** Paste a sync code: link to the main computer, or to the hosted database. */
export async function linkWithCodeAction(_prev: LinkState | null, formData: FormData): Promise<LinkState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  if (remoteUrlIsFromEnvironment()) {
    return { error: "This server was deployed with a hosted database, so it cannot be changed here." };
  }
  const raw = String(formData.get("code") ?? "").trim();
  if (!raw) return { error: "Paste a sync code" };
  const code = decodeSyncCode(raw);
  if (!code) return { error: "That is not a sync code. Copy it again from the Sync page of the other computer." };
  return code.k === "pg" ? linkHosted(code.u) : linkMain(raw.replace(/\s+/g, ""), code);
}

/** Stop syncing. Nothing is deleted; this computer simply works alone. */
export async function unlinkAction(): Promise<LinkState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  if (remoteUrlIsFromEnvironment()) {
    return { error: "This server was deployed with a hosted database, so it cannot be changed here." };
  }
  await setRemoteUrl(null);
  const { db } = await getDb();
  await db.query(`update _spir_peer set lan_code = null`);
  resetRemoteDb();
  return done("Unlinked. Everything stays on this computer.");
}

/** Turn serving the office network on or off. */
export async function setMainComputerAction(_prev: LinkState | null, formData: FormData): Promise<LinkState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  const on = String(formData.get("enabled")) === "true";
  const { db } = await getDb();
  const s = await readServerSetting();
  await db.query(`update _spir_lan_server set enabled = $1, secret = $2, updated_at = now()`, [
    on,
    on ? s.secret ?? newSecret() : s.secret,
  ]);
  await applyServerSetting();
  return done(on ? "This is now the main computer. Copy its code to the other computers." : "This computer no longer serves the office network.");
}

/** A fresh code: every computer linked with the old one must be linked again. */
export async function newMainCodeAction(): Promise<LinkState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  const { db } = await getDb();
  await db.query(`update _spir_lan_server set secret = $1, updated_at = now()`, [newSecret()]);
  await applyServerSetting();
  return done("A new code was made. Computers linked with the old one must be linked again.");
}

async function label(): Promise<string | undefined> {
  const { db } = await getDb();
  const r = await db
    .query<{ company_name: string | null }>(`select company_name from _spir_branding`)
    .catch(() => ({ rows: [] as { company_name: string | null }[] }));
  return r.rows[0]?.company_name?.trim() || undefined;
}

/** Show the code other computers paste — on request, never in the page itself. */
export async function showCodeAction(_prev: LinkState | null, formData: FormData): Promise<LinkState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  const which = String(formData.get("which"));
  if (which === "lan") {
    const code = await mainComputerCode(await label());
    return code ? { ok: true, code } : { error: "Turn on the main computer first." };
  }
  const url = await remoteUrl();
  return url ? { ok: true, code: encodeSyncCode({ k: "pg", u: url }) } : { error: "No hosted database is configured" };
}
