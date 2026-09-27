/**
 * Where this computer stands with its activation code — a pure judgement,
 * shared by the app and the tests (no imports).
 *
 *   off         no codes server is set for this build, or it says codes are off
 *   need        no license yet: the activation window (needs the internet once)
 *   ok          a genuine license for this computer, in date
 *   grace       a computer that held records before codes arrived: 30 days
 *   locked      expired, stopped, moved away, grace over, the clock turned back,
 *               or offline longer than the code allows (its license is signed
 *               with the day it was issued, so the count cannot be forged)
 *
 * A server that has never answered is taken as ON when one is configured:
 * the first registration is the one moment that needs the internet, and a
 * computer kept offline from the start must not run unlicensed for ever.
 */

export const GRACE_DAYS = 30;
export const WARN_DAYS = 14;
/** How far the clock may seem to go back (time-zone changes, a drifting clock) before it counts. */
export const CLOCK_SLACK_MS = 12 * 3600_000;
const DAY = 86_400_000;

export interface Payload {
  lid: string; co: string; dev: string; mods: string[]; until: number; seats: number;
  /** Days the computer may run without reaching the server; absent: no limit. */
  off?: number;
  /** When the server signed it (seconds). */
  iat?: number;
}

export type DeviceState =
  | { kind: "off" }
  | { kind: "need" }
  | { kind: "ok"; company: string; until: number; mods: string[]; seats: number; checkBy?: number }
  | { kind: "grace"; until: number }
  | { kind: "locked"; reason: "expired" | "stopped" | "gone" | "grace_over" | "clock" | "offline"; company?: string; until?: number };

export interface JudgeInput {
  /** A codes server is set for this build. */
  hasServer: boolean;
  /** The server's last answer: on, off, or never asked (null). */
  enabled: boolean | null;
  /** The stored license, already checked against its signature (null if none or not genuine). */
  payload: Payload | null;
  deviceId: string;
  /** Set when the server really refused this computer (stopped / expired / deleted / moved). */
  blocked: string | null;
  now: number;
  /** The latest time this computer has seen. */
  seen: number;
  legacy: boolean;
  graceStart: number | null;
}

export function judge(i: JudgeInput): DeviceState {
  if (!i.hasServer || i.enabled === false) return { kind: "off" };
  const rolledBack = i.seen - i.now > CLOCK_SLACK_MS;
  const now = Math.max(i.now, i.seen);
  const p = i.payload;
  if (p && p.dev === i.deviceId) {
    if (rolledBack) return { kind: "locked", reason: "clock", company: p.co, until: p.until };
    if (i.blocked) {
      const reason = i.blocked === "expired" ? "expired" : i.blocked === "stopped" ? "stopped" : "gone";
      return { kind: "locked", reason, company: p.co, until: p.until };
    }
    if (p.until <= now) return { kind: "locked", reason: "expired", company: p.co, until: p.until };
    const checkBy = offlineUntil(p);
    if (checkBy != null && checkBy <= now) return { kind: "locked", reason: "offline", company: p.co, until: p.until };
    return { kind: "ok", company: p.co, until: p.until, mods: p.mods, seats: p.seats, ...(checkBy != null ? { checkBy } : {}) };
  }
  if (i.legacy) {
    if (rolledBack) return { kind: "locked", reason: "clock" };
    const start = i.graceStart ?? i.now;
    const until = start + GRACE_DAYS * DAY;
    if (until <= now) return { kind: "locked", reason: "grace_over" };
    return { kind: "grace", until };
  }
  return { kind: "need" };
}

/** The moment a license with an offline limit must have been renewed by (null: no limit). */
export function offlineUntil(p: Payload): number | null {
  const off = Number(p.off);
  const iat = Number(p.iat);
  if (!(off > 0) || !(iat > 0)) return null;
  return iat * 1000 + off * DAY;
}

/** The app is closed on this computer until a code is entered. */
export const isLocked = (s: DeviceState) => s.kind === "need" || s.kind === "locked";

/** Stations this state opens: all of them unless a license narrows it. */
export const openStations = (s: DeviceState, all: string[]) => (s.kind === "ok" ? s.mods : all);

/** Days left, for the notices (null when nothing is ending). */
export function daysLeft(s: DeviceState, now: number): number | null {
  if (s.kind !== "ok" && s.kind !== "grace") return null;
  return Math.ceil((s.until - now) / DAY);
}

/**
 * What to do with the company's database carried by the code (see
 * company-db.ts): set it, remove it, only remember that the current link is
 * the code's, or nothing. Pure, so the rules are tested as they are.
 */
export type LinkPlan = { action: "set"; conn: string } | { action: "clear" } | { action: "note"; host: string } | { action: "none" };

export function planCompanyLink(i: {
  fromEnvironment: boolean;
  /** The hosted database this computer syncs with now (null: none). */
  current: string | null;
  /** The host of the link the code set earlier ("" if none). */
  setByCodeHost: string;
  /** Linked to a main computer on the office network. */
  lanLinked: boolean;
  /** The code's database now (null: none). */
  incoming: string | null;
  host: (url: string) => string;
  /** A transaction pooler this program cannot use. */
  unusable: (url: string) => boolean;
}): LinkPlan {
  if (i.fromEnvironment) return { action: "none" };
  const currentFromCode = !!i.current && !!i.setByCodeHost && i.host(i.current) === i.setByCodeHost;
  if (!i.incoming) return currentFromCode ? { action: "clear" } : { action: "none" };
  const conn = i.incoming.trim();
  if (!/^postgres(ql)?:\/\/\S+$/i.test(conn) || i.unusable(conn)) return { action: "none" };
  if (i.current === conn) return currentFromCode ? { action: "none" } : { action: "note", host: i.host(conn) };
  if (i.current && !currentFromCode) return { action: "none" }; // the company's own link stays
  if (!i.current && i.lanLinked) return { action: "none" }; // an office computer syncs through its main computer
  return { action: "set", conn };
}
