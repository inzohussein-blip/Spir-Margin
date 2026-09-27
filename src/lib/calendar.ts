/**
 * The daily calendar (from spir-lab-manager's calendar): pure month-grid
 * arithmetic, shared by the page and the tests. Weeks start on Saturday,
 * as they do in Iraq.
 */

export type EventKind = "appointment" | "visit" | "due" | "expiry" | "leave" | "calibration" | "review";
export const EVENT_KINDS: EventKind[] = ["appointment", "visit", "due", "expiry", "leave", "calibration", "review"];
export interface CalEvent { date: string; kind: EventKind; title: string; href: string; time?: string | null }

const utc = (ymd: string) => Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10));
const ymdOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (ymd: string, n: number) => ymdOf(utc(ymd) + n * 86_400_000);

/** The days to draw for a month: whole weeks from the Saturday on or before the 1st to the Friday on or after the last day. */
export function monthGrid(ym: string, weekStart = 6): string[] {
  const first = `${ym}-01`;
  const last = ymdOf(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0));
  const lead = (new Date(utc(first)).getUTCDay() - weekStart + 7) % 7;
  const trail = (weekStart + 6 - new Date(utc(last)).getUTCDay() + 7) % 7;
  const out: string[] = [];
  for (let d = addDays(first, -lead); d <= addDays(last, trail); d = addDays(d, 1)) out.push(d);
  return out;
}

/** The dates a stretch of days (a leave) covers inside [from, to]. */
export function spanDays(start: string, end: string, from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = start > from ? start : from; d <= (end < to ? end : to); d = addDays(d, 1)) out.push(d);
  return out;
}

export function byDay(events: CalEvent[]): Map<string, CalEvent[]> {
  const m = new Map<string, CalEvent[]>();
  for (const e of [...events].sort((a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title))) {
    const list = m.get(e.date) ?? [];
    list.push(e);
    m.set(e.date, list);
  }
  return m;
}
