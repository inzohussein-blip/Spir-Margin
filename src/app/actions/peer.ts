"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { setRemoteUrl, remoteUrl, remoteUrlIsFromEnvironment, resetRemoteDb } from "@/lib/db/pglite";

export interface PeerState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/** What Settings shows: never the password, only enough to recognise it. */
export interface PeerInfo {
  configured: boolean;
  fromEnvironment: boolean;
  summary: string | null;
}

/**
 * Describe the configured address without handing the password back to the
 * browser. Host and database name are enough to tell one server from another.
 */
function summarise(url: string): string {
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, "");
    return db ? `${u.host}/${db}` : u.host;
  } catch {
    return "…";
  }
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
  };
}

/** Open a connection and close it, so a bad address is caught before saving. */
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

export async function savePeerAction(_prev: PeerState | null, formData: FormData): Promise<PeerState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Only an admin can change this" };
  if (remoteUrlIsFromEnvironment()) {
    return { error: "This server was deployed with a hosted database, so it cannot be changed here." };
  }

  const url = String(formData.get("database_url") ?? "").trim();
  if (!url) return { error: "Enter a connection string" };
  if (!/^postgres(ql)?:\/\//i.test(url)) {
    return { error: "That does not look like a Postgres connection string" };
  }

  // Test before saving: a wrong address saved is a sync that silently never
  // works, and the person has walked away by the time anyone notices.
  const failure = await probe(url);
  if (failure) return { error: `Could not connect: ${failure}` };

  await setRemoteUrl(url);
  revalidatePath("/settings");
  return { ok: true, message: "Connected. Syncing will start on the next pass." };
}

export async function clearPeerAction(): Promise<PeerState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Only an admin can change this" };
  if (remoteUrlIsFromEnvironment()) {
    return { error: "This server was deployed with a hosted database, so it cannot be changed here." };
  }
  await setRemoteUrl(null);
  resetRemoteDb();
  revalidatePath("/settings");
  return { ok: true, message: "Disconnected. Everything stays on this computer." };
}
