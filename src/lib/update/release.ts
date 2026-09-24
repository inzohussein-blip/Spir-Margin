/**
 * Releases and versions as plain data. Pure, so the tests import it as is.
 *
 * A release is published by .github/workflows/release.yml for every commit
 * on main that passes CI: tag `build-N`, one asset `spir-margin.zip`, and
 * inside it `version.json` — {"number": N, "commit": "…", "date": "…"} —
 * which is how an installed copy knows what it is.
 */

export interface Build {
  number: number;
  commit: string | null;
  date: string | null;
}

export interface Release {
  number: number;
  /** YYYY-MM-DD */
  date: string | null;
  zip: string;
}

export type UpdateState =
  | "checking" | "uptodate" | "downloading" | "building" | "switching" | "starting"
  | "done" | "failed" | "rolledback";

/** What scripts/windows/update.ps1 writes to updates/status.json. */
export interface UpdateStatus {
  state: UpdateState;
  number: number;
  detail: string;
  at: string;
  pid: number;
}

const STATES: UpdateState[] = [
  "checking", "uptodate", "downloading", "building", "switching", "starting", "done", "failed", "rolledback",
];
const WORKING: UpdateState[] = ["checking", "downloading", "building", "switching", "starting"];

/** Longer than the slowest real update (a first `npm ci` on a slow line). */
export const STUCK_AFTER_MS = 90 * 60_000;

const stripBom = (s: string) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

export function parseVersionFile(text: string): Build | null {
  try {
    const v = JSON.parse(stripBom(text)) as Record<string, unknown>;
    const number = Number(v.number);
    if (!Number.isInteger(number) || number <= 0) return null;
    return {
      number,
      commit: typeof v.commit === "string" ? v.commit : null,
      date: typeof v.date === "string" ? v.date : null,
    };
  } catch {
    return null;
  }
}

/** GitHub's "latest release" answer, or null if it is not one of ours. */
export function parseRelease(json: unknown): Release | null {
  if (!json || typeof json !== "object") return null;
  const r = json as Record<string, unknown>;
  if (r.draft === true || r.prerelease === true) return null;
  const m = /^build-(\d+)$/.exec(String(r.tag_name ?? ""));
  if (!m) return null;
  const assets = Array.isArray(r.assets) ? (r.assets as Record<string, unknown>[]) : [];
  const zip = assets.find((a) => a && a.name === "spir-margin.zip")?.browser_download_url;
  if (typeof zip !== "string" || !zip) return null;
  const published = typeof r.published_at === "string" ? r.published_at.slice(0, 10) : null;
  return { number: Number(m[1]), date: published, zip };
}

/** A copy with no version.json predates releases: anything is newer. */
export function isNewer(release: Release | null, current: Build | null): boolean {
  if (!release) return false;
  return release.number > (current?.number ?? 0);
}

export function parseStatus(text: string): UpdateStatus | null {
  try {
    const s = JSON.parse(stripBom(text)) as Record<string, unknown>;
    if (!STATES.includes(s.state as UpdateState)) return null;
    return {
      state: s.state as UpdateState,
      number: Number(s.number) || 0,
      detail: String(s.detail ?? ""),
      at: String(s.at ?? ""),
      pid: Number(s.pid) || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Is an update under way? A status left "working" by an updater that was
 * killed (the computer switched off mid-build) stops counting after a while,
 * or no update could ever start again.
 */
export function isRunning(status: UpdateStatus | null, now: Date): boolean {
  if (!status || !WORKING.includes(status.state)) return false;
  const at = Date.parse(status.at);
  return Number.isFinite(at) && now.getTime() - at < STUCK_AFTER_MS;
}

/**
 * Save the automatic-update choice (table _spir_update, migration 0112).
 * Switching it on counts from now: the first automatic update waits for the
 * next scheduled time instead of starting this minute. Here, rather than
 * beside its caller, so the tests run this very statement.
 */
export const SAVE_UPDATE_SETTINGS_SQL = `
  update _spir_update
     set last_auto_at = case when $1::boolean and not auto then now() else last_auto_at end,
         auto = $1::boolean, at_time = $2, updated_at = now()`;
