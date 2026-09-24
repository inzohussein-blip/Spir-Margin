import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getDb, dumpLocalDatabase, workingTimeZone } from "@/lib/db/pglite";
import { isDue, nextRun, type BackupSchedule } from "./schedule";

/**
 * Automatic backups (migration 0110): the settings, the runner the server
 * calls every minute, and the list of files for Settings.
 *
 * Files are named spir-margin-auto-YYYY-MM-DD-HHMMSS.tar.gz — the same format
 * as the download in Settings, so either restores the same way — and only
 * the newest `keep` automatic ones stay. A copy taken just before a restore
 * is named spir-margin-before-restore-…, one taken just before an update
 * spir-margin-before-update-…; each kind keeps its newest 5.
 */

export interface BackupSettings extends BackupSchedule {
  enabled: boolean;
  /** null: the "backups" folder inside the program's folder. */
  folder: string | null;
  keep: number;
  lastRunAt: string | null;
  lastFile: string | null;
  lastError: string | null;
}

export interface BackupFile {
  name: string;
  size: number;
  at: string;
  kind: BackupKind;
}

export type BackupKind = "auto" | "before-restore" | "before-update";

const AUTO = "spir-margin-auto-";
const SAFETY = "spir-margin-before-restore-";
const PRE_UPDATE = "spir-margin-before-update-";
const PREFIX: Record<BackupKind, string> = { auto: AUTO, "before-restore": SAFETY, "before-update": PRE_UPDATE };
const isOurs = (n: string) => Object.values(PREFIX).some((p) => n.startsWith(p)) && n.endsWith(EXT);
const EXT = ".tar.gz";
const KEEP_SAFETY = 5;

export function defaultFolder(): string {
  return path.join(process.cwd(), "backups");
}

export async function readBackupSettings(): Promise<BackupSettings> {
  const { db } = await getDb();
  const r = await db.query<{
    enabled: boolean; frequency: BackupSchedule["frequency"]; every_hours: number; at_time: string;
    weekday: number; folder: string | null; keep: number;
    last_run_at: string | null; last_file: string | null; last_error: string | null;
  }>(`select * from _spir_backup`);
  const x = r.rows[0];
  return {
    enabled: x?.enabled ?? true,
    frequency: x?.frequency ?? "daily",
    everyHours: Number(x?.every_hours ?? 6),
    atTime: x?.at_time ?? "22:00",
    weekday: Number(x?.weekday ?? 4),
    folder: x?.folder ?? null,
    keep: Number(x?.keep ?? 14),
    lastRunAt: x?.last_run_at ?? null,
    lastFile: x?.last_file ?? null,
    lastError: x?.last_error ?? null,
  };
}

export function folderOf(s: Pick<BackupSettings, "folder">): string {
  return s.folder && s.folder.trim() ? s.folder.trim() : defaultFolder();
}

/** Can the program write there? null if so, otherwise why not. */
export function checkFolder(folder: string): string | null {
  try {
    if (!path.isAbsolute(folder)) return "not a full path";
    fs.mkdirSync(folder, { recursive: true });
    const probe = path.join(folder, `.spir-write-test-${process.pid}`);
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe, { force: true });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}

export async function saveBackupSettings(s: Omit<BackupSettings, "lastRunAt" | "lastFile" | "lastError">): Promise<void> {
  const { db } = await getDb();
  await db.query(
    `update _spir_backup set enabled = $1, frequency = $2, every_hours = $3, at_time = $4, weekday = $5,
            folder = $6, keep = $7, updated_at = now()`,
    [s.enabled, s.frequency, s.everyHours, s.atTime, s.weekday, s.folder, s.keep],
  );
}

function stamp(now: Date, tz: string): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(now).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}-${p.hour}${p.minute}${p.second}`;
}

export function listBackups(folder: string): BackupFile[] {
  let names: string[] = [];
  try {
    names = fs.readdirSync(folder);
  } catch {
    return [];
  }
  return names
    .filter(isOurs)
    .map((name) => {
      const st = fs.statSync(path.join(folder, name));
      const kind = (Object.keys(PREFIX) as BackupKind[]).find((k) => name.startsWith(PREFIX[k]))!;
      return { name, size: st.size, at: st.mtime.toISOString(), kind };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

function prune(folder: string, prefix: string, keep: number): void {
  const mine = listBackups(folder).filter((f) => f.name.startsWith(prefix));
  for (const f of mine.slice(keep)) fs.rmSync(path.join(folder, f.name), { force: true });
}

const G = globalThis as unknown as { __spirBackupRun?: Promise<string> | null };

/**
 * Take a backup now. Written to a temporary name and renamed when complete,
 * so a half-written file never looks like a backup.
 */
export async function takeBackup(kind: BackupKind): Promise<string> {
  if (G.__spirBackupRun) return G.__spirBackupRun;
  const run = (async () => {
    const s = await readBackupSettings();
    const folder = folderOf(s);
    const { db } = await getDb();
    try {
      const bad = checkFolder(folder);
      if (bad) throw new Error(`cannot write to ${folder}: ${bad}`);
      const name = `${PREFIX[kind]}${stamp(new Date(), workingTimeZone())}${EXT}`;
      const target = path.join(folder, name);
      const tmp = `${target}.partial`;
      const dump = Buffer.from(await (await dumpLocalDatabase()).arrayBuffer());
      fs.writeFileSync(tmp, dump);
      fs.renameSync(tmp, target);
      prune(folder, AUTO, s.keep);
      prune(folder, SAFETY, KEEP_SAFETY);
      prune(folder, PRE_UPDATE, KEEP_SAFETY);
      if (kind === "auto") {
        await db.query(`update _spir_backup set last_run_at = now(), last_file = $1, last_error = null`, [name]);
      }
      return name;
    } catch (e) {
      const msg = (e as Error).message;
      console.error("[backup] automatic backup failed:", msg);
      // Recorded, and the time noted, so a broken folder is retried at the
      // next scheduled moment rather than every minute.
      if (kind === "auto") {
        await db.query(`update _spir_backup set last_run_at = now(), last_error = $1`, [msg.slice(0, 400)]).catch(() => undefined);
      }
      throw e;
    }
  })().finally(() => {
    G.__spirBackupRun = null;
  });
  G.__spirBackupRun = run;
  return run;
}

/** Called every minute by the server: back up if the schedule says so. */
export async function backupTick(): Promise<void> {
  const s = await readBackupSettings();
  if (!s.enabled) return;
  if (!isDue(s, s.lastRunAt ? new Date(s.lastRunAt) : null, new Date(), workingTimeZone())) return;
  await takeBackup("auto").catch(() => undefined);
}

export function nextBackupAt(s: BackupSettings): Date | null {
  if (!s.enabled) return null;
  return nextRun(s, s.lastRunAt ? new Date(s.lastRunAt) : null, new Date(), workingTimeZone());
}

/** The full path of a listed backup, or null for any name that is not one. */
export function backupPath(folder: string, name: string): string | null {
  if (name !== path.basename(name)) return null;
  if (!isOurs(name)) return null;
  const p = path.join(folder, name);
  return fs.existsSync(p) ? p : null;
}
