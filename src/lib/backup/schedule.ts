/**
 * When the next automatic backup is due. Pure, so the tests import it as is.
 *
 * "Due" means a scheduled moment has passed since the last backup — so a
 * computer that was off at 22:00 backs up as soon as it is on again, rather
 * than skipping the day.
 */

export interface BackupSchedule {
  frequency: "hours" | "daily" | "weekly";
  everyHours: number;
  /** "HH:MM", in the company's time zone. */
  atTime: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
}

/** Minutes east of UTC for `tz` at the instant `at`. */
function offsetMinutes(at: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(at).map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The wall-clock date in `tz` for an instant: [year, month (1-12), day, weekday]. */
function localDate(at: Date, tz: string): [number, number, number, number] {
  const shifted = new Date(at.getTime() + offsetMinutes(at, tz) * 60_000);
  return [shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate(), shifted.getUTCDay()];
}

/** The instant a wall-clock time in `tz` falls on. */
function atLocal(y: number, m: number, d: number, hh: number, mm: number, tz: string): Date {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  return new Date(guess.getTime() - offsetMinutes(guess, tz) * 60_000);
}

/** The most recent scheduled moment at or before `now` (for daily/weekly). */
export function lastSlot(s: BackupSchedule, now: Date, tz: string): Date {
  const [hh, mm] = s.atTime.split(":").map(Number);
  const [y, m, d, wd] = localDate(now, tz);
  let back = 0;
  if (s.frequency === "weekly") back = (wd - s.weekday + 7) % 7;
  let slot = atLocal(y, m, d - back, hh, mm, tz);
  if (slot.getTime() > now.getTime()) {
    const step = s.frequency === "weekly" ? 7 : 1;
    slot = atLocal(y, m, d - back - step, hh, mm, tz);
  }
  return slot;
}

export function isDue(s: BackupSchedule, lastRun: Date | null, now: Date, tz: string): boolean {
  if (s.frequency === "hours") {
    return !lastRun || now.getTime() - lastRun.getTime() >= s.everyHours * 3_600_000;
  }
  const slot = lastSlot(s, now, tz);
  return !lastRun || lastRun.getTime() < slot.getTime();
}

/** When it will next run, for the Settings page. */
export function nextRun(s: BackupSchedule, lastRun: Date | null, now: Date, tz: string): Date {
  if (s.frequency === "hours") {
    return lastRun ? new Date(Math.max(now.getTime(), lastRun.getTime() + s.everyHours * 3_600_000)) : now;
  }
  if (isDue(s, lastRun, now, tz)) return now;
  const step = s.frequency === "weekly" ? 7 : 1;
  const slot = lastSlot(s, now, tz);
  const [y, m, d] = localDate(slot, tz);
  const [hh, mm] = s.atTime.split(":").map(Number);
  return atLocal(y, m, d + step, hh, mm, tz);
}
