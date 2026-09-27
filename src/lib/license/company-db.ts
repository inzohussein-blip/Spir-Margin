import "server-only";
import { getDb, remoteUrl, remoteUrlIsFromEnvironment, setRemoteUrl, resetRemoteDb, isTransactionPooler } from "@/lib/db/pglite";
import { databaseHost } from "@/lib/db/probe";
import type { DeviceSync } from "./core";
import { planCompanyLink } from "./state";

/**
 * The company's own database, carried by its activation code.
 *
 * The owner may link a subscriber's code to that company's hosted Postgres
 * (Supabase or any PostgreSQL). Every computer that activates the code then
 * receives it with its license and syncs with it — its work is still done
 * and saved here first, as always. The rules keep a company's data where the
 * company put it:
 *
 *   - an office computer linked to a main computer keeps that link (the main
 *     computer holds the company's upstream);
 *   - a hosted database the company linked itself on the Sync page is never
 *     replaced — its host is reported to the owner instead;
 *   - a link that came from the code follows the code: changed or removed by
 *     the owner, it is changed or removed here (removing keeps every record
 *     on this computer);
 *   - a server deployed with DATABASE_URL is never touched.
 *
 * `_spir_license.sync_host` remembers the host of the link the code set.
 */

async function lanLinked(): Promise<boolean> {
  const { db } = await getDb();
  const r = await db.query(`select lan_code from _spir_peer`).catch(() => ({ rows: [] as Record<string, unknown>[] }));
  return !!(r.rows[0] as { lan_code?: string | null } | undefined)?.lan_code;
}

async function fromCode(): Promise<string> {
  const { db } = await getDb();
  const r = await db.query(`select sync_host from _spir_license`);
  return String((r.rows[0] as { sync_host?: string } | undefined)?.sync_host ?? "");
}

async function noteFromCode(host: string): Promise<void> {
  const { db } = await getDb();
  await db.query(`update _spir_license set sync_host = $1, updated_at = now()`, [host]);
}

export async function applyCompanyDatabase(sync: DeviceSync | null): Promise<void> {
  const current = remoteUrlIsFromEnvironment() ? null : await remoteUrl();
  const plan = planCompanyLink({
    fromEnvironment: remoteUrlIsFromEnvironment(),
    current,
    setByCodeHost: await fromCode(),
    lanLinked: await lanLinked(),
    incoming: sync?.conn ?? null,
    host: databaseHost,
    unusable: isTransactionPooler,
  });
  if (plan.action === "set") {
    await setRemoteUrl(plan.conn);
    await noteFromCode(databaseHost(plan.conn));
  } else if (plan.action === "clear") {
    await setRemoteUrl(null);
    resetRemoteDb();
    await noteFromCode("");
  } else if (plan.action === "note") {
    await noteFromCode(plan.host);
  }
}

/** A hosted database this computer linked on its own (host only), for the owner's list; null when none or from the code. */
export async function ownLinkedHost(): Promise<string | null> {
  if (remoteUrlIsFromEnvironment()) return null;
  const current = await remoteUrl();
  if (!current) return "";
  const setByCode = await fromCode();
  return setByCode && databaseHost(current) === setByCode ? null : databaseHost(current);
}

/** For the Sync page: the link came with the activation code. */
export async function linkFromCode(): Promise<string | null> {
  if (remoteUrlIsFromEnvironment()) return null;
  const current = await remoteUrl();
  const setByCode = await fromCode().catch(() => "");
  return current && setByCode && databaseHost(current) === setByCode ? setByCode : null;
}
