"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { runSync, syncStatus, type SyncResult, type SyncStatus } from "@/lib/sync/engine";

/** Where database sync stands. Cheap: reads local tables, no network. */
export async function getSyncStatusAction(): Promise<SyncStatus> {
  const user = await getCurrentUser();
  if (!user) return { configured: false, reachable: false, pending: 0, lastSyncAt: null, lastError: null };
  return syncStatus();
}

/** Run a sync pass now (the "Sync now" button, and the periodic auto-sync). */
export async function syncNowAction(): Promise<SyncResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, pushed: 0, pulled: 0, error: "Not signed in" };
  return runSync();
}
