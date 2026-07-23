"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";

/** Only admins and managers may view or act on monitoring data. */
async function requireAuthorised() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "admin" && user.role !== "manager")) return null;
  return user;
}

/**
 * Record an application error. Callable from the client error reporter and
 * error boundaries; safe to call while signed out (user_email is best-effort).
 * Never throws — logging an error must not itself cause one.
 */
export async function logError(input: {
  message: string;
  detail?: string | null;
  path?: string | null;
  source?: "client" | "server";
  severity?: "error" | "warning";
}) {
  try {
    const user = await getCurrentUser();
    const supabase = createClient();
    await supabase.from("app_errors").insert({
      message: String(input.message ?? "").slice(0, 2000) || "Unknown error",
      detail: input.detail ? String(input.detail).slice(0, 8000) : null,
      path: input.path ? String(input.path).slice(0, 500) : null,
      source: input.source === "server" ? "server" : "client",
      severity: input.severity === "warning" ? "warning" : "error",
      user_email: user?.email ?? null,
    });
  } catch {
    /* swallow — monitoring must never break the app */
  }
}

/** Record one completed offline period (logged by the client on reconnect). */
export async function logConnectivityEvent(input: {
  wentOfflineAt: string;
  cameOnlineAt: string;
  durationSeconds: number;
}) {
  try {
    const user = await getCurrentUser();
    const supabase = createClient();
    await supabase.from("connectivity_events").insert({
      user_email: user?.email ?? null,
      went_offline_at: input.wentOfflineAt,
      came_online_at: input.cameOnlineAt,
      duration_seconds: Math.max(0, Math.round(Number(input.durationSeconds) || 0)),
    });
  } catch {
    /* swallow */
  }
}

/** Record the result of an outbox flush (how many items synced, ok/fail). */
export async function logSyncEvent(input: { itemCount: number; ok: boolean; detail?: string | null }) {
  try {
    const user = await getCurrentUser();
    const supabase = createClient();
    await supabase.from("sync_events").insert({
      user_email: user?.email ?? null,
      item_count: Math.max(0, Math.round(Number(input.itemCount) || 0)),
      ok: input.ok !== false,
      detail: input.detail ? String(input.detail).slice(0, 2000) : null,
    });
  } catch {
    /* swallow */
  }
}

/** Mark an error resolved / reopen it (authorised users only). */
export async function setErrorResolved(fd: FormData) {
  if (!(await requireAuthorised())) return;
  const id = String(fd.get("id"));
  const resolved = String(fd.get("resolved")) === "true";
  const supabase = createClient();
  await supabase.from("app_errors").update({ resolved }).eq("id", id);
  revalidatePath("/monitoring/errors");
}

/** Clear every resolved error (authorised users only). */
export async function clearResolvedErrors() {
  if (!(await requireAuthorised())) return;
  const supabase = createClient();
  await supabase.from("app_errors").delete().eq("resolved", true);
  revalidatePath("/monitoring/errors");
}
