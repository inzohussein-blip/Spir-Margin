/**
 * Cold chain & calibration — the rules, pure (no imports), shared by the
 * pages and the tests. Ported from spir-lab-manager's quality station.
 */

export type Slot = "AM" | "PM";
export const SLOTS: Slot[] = ["AM", "PM"];
export type UnitKind = "fridge" | "freezer" | "room" | "incubator" | "other";
export const UNIT_KINDS: UnitKind[] = ["fridge", "freezer", "room", "incubator", "other"];
/** The usual safe range for each kind, offered when a unit is added. */
export const KIND_RANGE: Record<UnitKind, [number, number]> = {
  fridge: [2, 8], freezer: [-25, -15], room: [15, 25], incubator: [36, 38], other: [2, 8],
};

export interface Unit { id: string; name: string; kind: UnitKind; min_temp: number; max_temp: number; is_active: boolean }
export interface Reading { unit_id: string; reading_date: string; slot: Slot; value: number; action?: string | null; recorded_by?: string | null }

export const inRange = (u: Pick<Unit, "min_temp" | "max_temp">, v: number) => v >= Number(u.min_temp) && v <= Number(u.max_temp);

/** A unit's month: each day's AM and PM reading, how many are out of range, how many are missing. */
export function unitMonth(u: Unit, readings: Reading[], ym: string, today: string) {
  const days = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
  const rows: { date: string; AM?: Reading; PM?: Reading }[] = [];
  let out = 0, missing = 0, min = Infinity, max = -Infinity;
  for (let i = 1; i <= days; i++) {
    const date = `${ym}-${String(i).padStart(2, "0")}`;
    const row: { date: string; AM?: Reading; PM?: Reading } = { date };
    for (const s of SLOTS) {
      const r = readings.find((x) => x.unit_id === u.id && x.reading_date === date && x.slot === s);
      if (r) {
        row[s] = r;
        const v = Number(r.value);
        if (!inRange(u, v)) out++;
        min = Math.min(min, v);
        max = Math.max(max, v);
      } else if (date < today) {
        missing++;
      }
    }
    rows.push(row);
  }
  return { rows, out, missing, min: Number.isFinite(min) ? min : null, max: Number.isFinite(max) ? max : null };
}

/** Today's readings still to take (active units), and those out of range without an action written. */
export function todayStatus(units: Unit[], readings: Reading[], today: string, slot: Slot) {
  const active = units.filter((u) => u.is_active);
  const due = active.filter((u) => !readings.some((r) => r.unit_id === u.id && r.reading_date === today && r.slot === slot));
  const alarms = readings.filter((r) => {
    const u = active.find((x) => x.id === r.unit_id);
    return u && r.reading_date === today && !inRange(u, Number(r.value)) && !r.action;
  });
  return { due, alarms };
}

// ── Instruments ──────────────────────────────────────────────────────────────
export type Freq = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export const FREQS: Freq[] = ["daily", "weekly", "monthly", "quarterly", "yearly"];
export const FREQ_DAYS: Record<Freq, number> = { daily: 1, weekly: 7, monthly: 30, quarterly: 91, yearly: 365 };

const DAY = 86_400_000;
const utc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
export const addDays = (ymd: string, n: number) => new Date(utc(ymd) + n * DAY).toISOString().slice(0, 10);
export function addMonths(ymd: string, n: number): string {
  const y = +ymd.slice(0, 4), m = +ymd.slice(5, 7) - 1 + n, d = +ymd.slice(8, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}
export const daysBetween = (a: string, b: string) => Math.round((utc(b) - utc(a)) / DAY);

/** When a task is next due, and whether it is due now (never done: due today). */
export function taskDue(freq: Freq, lastDone: string | null, today: string) {
  const next = lastDone ? addDays(lastDone, FREQ_DAYS[freq]) : today;
  return { next, due: next <= today, overdueDays: Math.max(0, daysBetween(next, today)) };
}

/** Calibration: when it is next due, and how many days are left (negative: overdue). null when no interval is set. */
export function calibrationDue(lastCalibrated: string | null, months: number | null, today: string) {
  if (!months) return null;
  const next = lastCalibrated ? addMonths(lastCalibrated, months) : today;
  return { next, daysLeft: daysBetween(today, next) };
}
