"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkForUpdate, saveUpdateSettings, startUpdate, updateAvailable, updateKind } from "@/lib/update/updates";

export interface UpdateActionState {
  error?: string;
  detail?: string;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

/** Ask for the newest release now. */
export async function checkUpdatesAction(): Promise<UpdateActionState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  await checkForUpdate(true);
  redirect("/settings?update=checked#updates");
}

/** Install the newest release on this computer. */
export async function installUpdateAction(): Promise<UpdateActionState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  if (updateKind() !== "windows") return { error: "This computer cannot update itself. Follow the steps shown." };
  if (!updateAvailable()) return { error: "There is no newer release to install." };
  try {
    await startUpdate();
  } catch (e) {
    return { error: "The update could not be started.", detail: (e as Error).message };
  }
  redirect("/settings?update=started#updates");
}

export async function saveUpdateSettingsAction(_prev: UpdateActionState | null, formData: FormData): Promise<UpdateActionState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  const atTime = String(formData.get("at_time") ?? "02:00");
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(atTime)) return { error: "Enter a time such as 22:00" };
  await saveUpdateSettings(formData.get("auto") === "on", atTime);
  redirect("/settings?update=saved#updates");
}
