"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkFolder, folderOf, saveBackupSettings, takeBackup } from "@/lib/backup/auto";

export interface AutoBackupState {
  error?: string;
  detail?: string;
}

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

/** Save the schedule. The folder is tried before it is accepted. */
export async function saveAutoBackupAction(_prev: AutoBackupState | null, formData: FormData): Promise<AutoBackupState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  const frequency = String(formData.get("frequency"));
  if (!["hours", "daily", "weekly"].includes(frequency)) return { error: "Choose how often" };
  const everyHours = Math.round(Number(formData.get("every_hours") ?? 6));
  if (!(everyHours >= 1 && everyHours <= 168)) return { error: "Every 1 to 168 hours" };
  const atTime = String(formData.get("at_time") ?? "22:00");
  if (!/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(atTime)) return { error: "Enter a time such as 22:00" };
  const weekday = Math.round(Number(formData.get("weekday") ?? 4));
  if (!(weekday >= 0 && weekday <= 6)) return { error: "Choose a day" };
  const keep = Math.round(Number(formData.get("keep") ?? 14));
  if (!(keep >= 1 && keep <= 365)) return { error: "Keep between 1 and 365 copies" };
  const folderRaw = String(formData.get("folder") ?? "").trim();
  const folder = folderRaw || null;
  const bad = checkFolder(folderOf({ folder }));
  if (bad) return { error: "The program cannot write to that folder. Check the path, and that the drive is connected.", detail: bad };

  await saveBackupSettings({
    enabled: formData.get("enabled") === "on",
    frequency: frequency as "hours" | "daily" | "weekly",
    everyHours,
    atTime,
    weekday,
    folder,
    keep,
  });
  redirect("/settings?backup=saved#auto-backup");
}

/** Back up now, whatever the schedule says. */
export async function backupNowAction(): Promise<AutoBackupState> {
  if (!(await requireAdmin())) return { error: "Only an admin can change this" };
  try {
    await takeBackup("auto");
  } catch (e) {
    return { error: "The backup could not be written.", detail: (e as Error).message };
  }
  redirect("/settings?backup=done#auto-backup");
}
