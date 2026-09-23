"use server";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  runSync,
  syncStatus,
  listRejects,
  retryReject,
  dismissReject,
  type SyncResult,
  type SyncStatus,
  type SyncReject,
} from "@/lib/sync/engine";
import { revalidatePath } from "next/cache";

/** Where database sync stands. Cheap: reads local tables, no network. */
export async function getSyncStatusAction(): Promise<SyncStatus> {
  const user = await getCurrentUser();
  if (!user) return { configured: false, kind: null, label: null, reachable: false, pending: 0, lastSyncAt: null, lastError: null };
  return syncStatus();
}

/** Run a sync pass now (the "Sync now" button, and the periodic auto-sync). */
export async function syncNowAction(): Promise<SyncResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, pushed: 0, pulled: 0, error: "Not signed in" };
  return runSync();
}

/** Changes the far end is still refusing. */
export async function listRejectsAction(): Promise<SyncReject[]> {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "manager")) return [];
  return listRejects();
}

/** Send a refused change again. */
export async function retryRejectAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return;
  await retryReject(String(formData.get("id") ?? ""));
  revalidatePath("/monitoring/sync");
}

/** Stop tracking a refusal the company has decided not to act on. */
export async function dismissRejectAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return;
  await dismissReject(String(formData.get("id") ?? ""));
  revalidatePath("/monitoring/sync");
}
