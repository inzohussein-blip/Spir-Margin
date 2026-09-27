"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { setRemoteUrl, remoteUrl, remoteUrlIsFromEnvironment, resetRemoteDb, isTransactionPooler } from "@/lib/db/pglite";
import { databaseHost as summarise, probeDatabase as probe } from "@/lib/db/probe";
import { linkFromCode } from "@/lib/license/company-db";

export interface PeerState {
  error?: string;
  /** The database's own words, shown as they are under the translated error. */
  detail?: string;
  ok?: boolean;
  message?: string;
}

/** What Settings shows: never the password, only enough to recognise it. */
export interface PeerInfo {
  configured: boolean;
  fromEnvironment: boolean;
  summary: string | null;
  /** The link came with this computer's activation code (the provider sets it). */
  fromCode?: boolean;
}

export async function getPeerInfoAction(): Promise<PeerInfo> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return { configured: false, fromEnvironment: false, summary: null };
  }
  const url = await remoteUrl();
  return {
    configured: !!url,
    fromEnvironment: remoteUrlIsFromEnvironment(),
    summary: url ? summarise(url) : null,
    fromCode: !!(await linkFromCode().catch(() => null)),
  };
}

export async function savePeerAction(_prev: PeerState | null, formData: FormData): Promise<PeerState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Only an admin can change this" };
  if (remoteUrlIsFromEnvironment()) {
    return { error: "This server was deployed with a hosted database, so it cannot be changed here." };
  }
  if (await linkFromCode().catch(() => null)) {
    return { error: "This link comes with the company's activation code. Ask the provider to change it." };
  }

  const url = String(formData.get("database_url") ?? "").trim();
  if (!url) return { error: "Enter a connection string" };
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    return { error: "That does not look like a Postgres connection string" };
  }

  if (isTransactionPooler(url)) {
    return { error: "This address goes through the transaction pooler (port 6543), which this program cannot use. In Supabase choose the Session pooler (port 5432) or the Direct connection." };
  }

  // Test before saving: a wrong address saved is a sync that silently never
  // works, and the person has walked away by the time anyone notices.
  const failure = await probe(url);
  if (failure) return { error: "Could not connect. Check the address and the password, and that this computer is online.", detail: failure };

  await setRemoteUrl(url);
  // One upstream at a time: the hosted database replaces the main computer.
  const { getDb } = await import("@/lib/db/pglite");
  const { db } = await getDb();
  await db.query(`update _spir_peer set lan_code = null`);
  revalidatePath("/settings");
  revalidatePath("/sync");
  return { ok: true, message: "Connected. Syncing will start on the next pass." };
}

export async function clearPeerAction(): Promise<PeerState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Only an admin can change this" };
  if (remoteUrlIsFromEnvironment()) {
    return { error: "This server was deployed with a hosted database, so it cannot be changed here." };
  }
  if (await linkFromCode().catch(() => null)) {
    return { error: "This link comes with the company's activation code. Ask the provider to change it." };
  }
  await setRemoteUrl(null);
  resetRemoteDb();
  revalidatePath("/settings");
  revalidatePath("/sync");
  return { ok: true, message: "Disconnected. Everything stays on this computer." };
}
