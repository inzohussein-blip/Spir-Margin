import "server-only";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { getDb, workingTimeZone } from "@/lib/db/pglite";
import { takeBackup } from "@/lib/backup/auto";
import { isDue } from "@/lib/backup/schedule";
import {
  SAVE_UPDATE_SETTINGS_SQL, isNewer, isRunning, parseRelease, parseStatus, parseVersionFile,
  type Build, type Release, type UpdateStatus,
} from "./release";

/**
 * Updates (migration 0112).
 *
 * Where the program learns of a new release, and how it installs one:
 *   web      Vercel builds every push to main by itself; nothing to do here.
 *   windows  scripts/windows/update.ps1 downloads, builds beside the running
 *            program, swaps and restarts — started from Settings, or by the
 *            nightly check when automatic updates are on.
 *   manual   any other computer (Linux): Settings says what to run.
 *
 * Asking GitHub is best-effort: offline, the answer is simply "could not
 * check", and nothing else waits on it.
 */

export type UpdateKind = "web" | "windows" | "manual";

export interface CheckResult {
  release: Release | null;
  error: string | null;
  checkedAt: string | null;
}

export interface UpdateSettings {
  auto: boolean;
  atTime: string;
  lastAutoAt: string | null;
}

const REPO = process.env.SPIR_UPDATE_REPO || "inzohussein-blip/Spir-Margin";
const API = (process.env.SPIR_UPDATE_API || "https://api.github.com").replace(/\/+$/, "");
const CHECK_EVERY_MS = 6 * 3_600_000;
const RETRY_AFTER_ERROR_MS = 30 * 60_000;

const G = globalThis as unknown as { __spirUpdateCheck?: CheckResult; __spirUpdateChecking?: Promise<CheckResult> | null };

const updatesDir = () => path.join(process.cwd(), "updates");
const updaterScript = () => path.join(process.cwd(), "scripts", "windows", "update.ps1");

export function updateKind(): UpdateKind {
  if (process.env.VERCEL) return "web";
  if (process.platform === "win32" && fs.existsSync(updaterScript())) return "windows";
  return "manual";
}

/** Which release this copy is; null for a copy that predates releases. */
export function currentBuild(): Build | null {
  try {
    return parseVersionFile(fs.readFileSync(path.join(process.cwd(), "version.json"), "utf8"));
  } catch {
    return null;
  }
}

/** The last answer, without asking again. */
export function lastCheck(): CheckResult {
  return G.__spirUpdateCheck ?? { release: null, error: null, checkedAt: null };
}

export function updateAvailable(): Release | null {
  if (updateKind() === "web") return null;
  const r = lastCheck().release;
  return isNewer(r, currentBuild()) ? r : null;
}

/** Ask GitHub for the newest release. Cached; `force` asks now. */
export async function checkForUpdate(force = false): Promise<CheckResult> {
  const last = G.__spirUpdateCheck;
  // Offline last time: try again sooner than usual.
  const ttl = last?.error ? RETRY_AFTER_ERROR_MS : CHECK_EVERY_MS;
  if (!force && last?.checkedAt && Date.now() - Date.parse(last.checkedAt) < ttl) return last;
  if (G.__spirUpdateChecking) return G.__spirUpdateChecking;
  const run = (async (): Promise<CheckResult> => {
    const checkedAt = new Date().toISOString();
    try {
      const res = await fetch(`${API}/repos/${REPO}/releases/latest`, {
        headers: { Accept: "application/vnd.github+json", "User-Agent": "Spir-Margin" },
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      });
      if (res.status === 404) return { release: null, error: null, checkedAt };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { release: parseRelease(await res.json()), error: null, checkedAt };
    } catch (e) {
      return { release: last?.release ?? null, error: (e as Error).message || "unreachable", checkedAt };
    }
  })().then((r) => (G.__spirUpdateCheck = r)).finally(() => {
    G.__spirUpdateChecking = null;
  });
  G.__spirUpdateChecking = run;
  return run;
}

export function readUpdateStatus(): UpdateStatus | null {
  try {
    return parseStatus(fs.readFileSync(path.join(updatesDir(), "status.json"), "utf8"));
  } catch {
    return null;
  }
}

export function updateRunning(): boolean {
  return isRunning(readUpdateStatus(), new Date());
}

export async function readUpdateSettings(): Promise<UpdateSettings> {
  const { db } = await getDb();
  const r = await db.query<{ auto: boolean; at_time: string; last_auto_at: string | null }>(
    `select auto, at_time, last_auto_at from _spir_update`,
  );
  const x = r.rows[0];
  return { auto: x?.auto ?? false, atTime: x?.at_time ?? "02:00", lastAutoAt: x?.last_auto_at ?? null };
}

export async function saveUpdateSettings(auto: boolean, atTime: string): Promise<void> {
  const { db } = await getDb();
  await db.query(SAVE_UPDATE_SETTINGS_SQL, [auto, atTime]);
}

/**
 * Start the updater, detached: it stops this very server on the way, so it
 * must not be a child that dies with it. A backup is taken first, which
 * Settings can restore like any other.
 */
export async function startUpdate(): Promise<void> {
  if (updateKind() !== "windows") throw new Error("this computer does not update itself");
  if (updateRunning()) return;
  fs.mkdirSync(updatesDir(), { recursive: true });
  fs.writeFileSync(
    path.join(updatesDir(), "status.json"),
    JSON.stringify({ state: "checking", number: 0, detail: "starting", at: new Date().toISOString(), pid: 0 }),
  );
  const fail = (e: Error) =>
    fs.writeFileSync(
      path.join(updatesDir(), "status.json"),
      JSON.stringify({ state: "failed", number: 0, detail: e.message, at: new Date().toISOString(), pid: 0 }),
    );
  try {
    await takeBackup("before-update");
  } catch (e) {
    // No backup, no update: the data is what an update must never risk.
    fail(e as Error);
    throw e;
  }
  const args = ["-NoProfile", "-ExecutionPolicy", "Bypass", "-WindowStyle", "Hidden", "-File", updaterScript(), "-Quiet"];
  if (process.env.PORT) args.push("-Port", String(Number(process.env.PORT)));
  const child = spawn("powershell.exe", args, { cwd: process.cwd(), detached: true, stdio: "ignore", windowsHide: true });
  child.on("error", fail);
  child.unref();
}

/**
 * Called every minute by the server: ask for news a few times a day, and
 * install it at the chosen hour when automatic updates are on.
 */
export async function updateTick(): Promise<void> {
  const kind = updateKind();
  if (kind === "web" || process.env.SPIR_UPDATES === "off") return;
  await checkForUpdate();
  if (kind !== "windows" || !updateAvailable() || updateRunning()) return;
  const s = await readUpdateSettings();
  if (!s.auto) return;
  const schedule = { frequency: "daily" as const, atTime: s.atTime, everyHours: 24, weekday: 0 };
  if (!isDue(schedule, s.lastAutoAt ? new Date(s.lastAutoAt) : null, new Date(), workingTimeZone())) return;
  const { db } = await getDb();
  await db.query(`update _spir_update set last_auto_at = now()`);
  await startUpdate();
}
