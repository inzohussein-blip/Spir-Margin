"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/current-user";
import { restoreLocalDatabase } from "@/lib/db/pglite";

export interface RestoreState {
  error?: string;
  ok?: boolean;
  message?: string;
}

/** Largest backup accepted, so a wrong file cannot exhaust memory. */
const MAX_BYTES = 512 * 1024 * 1024;

/**
 * Replace this machine's database with an uploaded backup.
 *
 * This destroys whatever is currently here, so it is admin-only and the form
 * makes the person confirm before it is reachable.
 */
export async function restoreBackupAction(
  _prev: RestoreState | null,
  formData: FormData,
): Promise<RestoreState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return { error: "Only an admin can restore a backup" };

  const file = formData.get("backup");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a backup file first" };
  }
  if (file.size > MAX_BYTES) {
    return { error: "That file is too large to be a backup of this database" };
  }
  if (String(formData.get("confirm") ?? "") !== "yes") {
    return { error: "Confirm that the current data will be replaced" };
  }

  try {
    await restoreLocalDatabase(file);
  } catch (e) {
    console.error("[backup] restore failed:", e);
    // A truncated or unrelated file lands here; the old data is already gone
    // by then, which is exactly why the form insists on a confirmation.
    return { error: "That file could not be restored. It may not be a Spir-Margin backup." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "The backup was restored" };
}
