/**
 * The code manager's judgements — pure (no imports), shared by the /licenses
 * page, the receipt and the tests: the state of a code, the filters and their
 * counts, the order, the time left, inactive and outdated computers, the
 * owner's price for a code, the money received per month, and the messages
 * the owner sends a company.
 */

export const DAY = 86_400_000;
/** A code ending within this many days is «ending soon»; its reminder is due. */
export const WARN_DAYS = 14;
/** A computer not heard from for this long is flagged inactive. */
export const INACTIVE_DAYS = 30;

export interface PanelDevice {
  device_id: string; label: string; name: string; activated_at: number; last_seen_at: number | null; app_version: string;
  sync_kind: string; sync_at: number | null; sync_pending: number | null; sync_error: string;
}
export interface PanelRow {
  id: string; company: string; note: string; code_hint: string; duration_days: number; seats: number; modules: string[];
  status: "active" | "stopped"; activated_at: number | null; expires_at: number | null; created_at: number;
  price: string; paid: boolean; paid_at: number | null; message: string; is_trial: boolean;
  phone: string; max_offline_days: number;
  sync: { host: string; by: "owner" | "device"; at: number } | null; devices: PanelDevice[];
}

export type CodeState = "active" | "waiting" | "expiring" | "expired" | "stopped";
export function stateOf(r: PanelRow, now: number, warn = WARN_DAYS): CodeState {
  if (r.status === "stopped") return "stopped";
  if (r.expires_at == null) return "waiting";
  if (r.expires_at <= now) return "expired";
  if (r.expires_at - now <= warn * DAY) return "expiring";
  return "active";
}

/** "build-42" → 42 (null for anything else). */
export const buildNo = (v: string) => { const m = /^build-(\d+)$/.exec(v ?? ""); return m ? Number(m[1]) : null; };

export const inactiveDevice = (d: PanelDevice, now: number) => now - (d.last_seen_at ?? d.activated_at) > INACTIVE_DAYS * DAY;
export const outdatedDevice = (d: PanelDevice, latest: number | null) => {
  const n = buildNo(d.app_version);
  return latest != null && n != null && n < latest;
};

export const FILTERS = ["all", "active", "expiring", "expired", "waiting", "stopped", "unpaid", "trial", "outdated", "inactive"] as const;
export type Filter = (typeof FILTERS)[number];

export function matches(r: PanelRow, f: Filter, now: number, latest: number | null, warn = WARN_DAYS): boolean {
  switch (f) {
    case "all": return true;
    case "unpaid": return !r.paid && !r.is_trial;
    case "trial": return r.is_trial;
    case "outdated": return r.devices.some((d) => outdatedDevice(d, latest));
    case "inactive": return r.devices.some((d) => inactiveDevice(d, now));
    default: return stateOf(r, now, warn) === f;
  }
}

export function counts(rows: PanelRow[], now: number, latest: number | null, warn = WARN_DAYS): Record<Filter, number> {
  const out = {} as Record<Filter, number>;
  for (const f of FILTERS) out[f] = rows.filter((r) => matches(r, f, now, latest, warn)).length;
  return out;
}

export const SORTS = ["expiry", "newest", "name", "seen"] as const;
export type Sort = (typeof SORTS)[number];

const lastSeen = (r: PanelRow) => Math.max(0, ...r.devices.map((d) => d.last_seen_at ?? 0));

/** Nearest expiry first (not started yet after those), newest, by name, or most recently seen. */
export function sortRows(rows: PanelRow[], by: Sort): PanelRow[] {
  const x = [...rows];
  if (by === "newest") return x.sort((a, b) => b.created_at - a.created_at);
  if (by === "name") return x.sort((a, b) => a.company.localeCompare(b.company, "ar"));
  if (by === "seen") return x.sort((a, b) => lastSeen(b) - lastSeen(a));
  return x.sort((a, b) => (a.expires_at ?? Infinity) - (b.expires_at ?? Infinity) || b.created_at - a.created_at);
}

/** What part of the period is left (0–1) and how many days; null before the first computer. */
export function timeLeft(r: PanelRow, now: number): { fraction: number; days: number } | null {
  if (r.expires_at == null) return null;
  const start = r.activated_at ?? r.expires_at - r.duration_days * DAY;
  const total = Math.max(DAY, r.expires_at - start);
  const left = r.expires_at - now;
  return { fraction: Math.max(0, Math.min(1, left / total)), days: Math.ceil(left / DAY) };
}

// ── Prices ───────────────────────────────────────────────────────────────────
export interface Plan { currency: string; stations: Record<string, number>; seat: number; trialDays: number }

/** Months a period is billed as: a year is 12, a week still one. */
export const billedMonths = (days: number) => Math.max(1, Math.round(days / 30));

/** The price of a code from the owner's plan: the stations it opens, its extra computers, its months. */
export function quote(plan: Plan, modules: string[], days: number, seats: number): { monthly: number; months: number; total: number } {
  const monthly = modules.reduce((s, m) => s + (plan.stations[m] ?? 0), 0) + Math.max(0, seats - 1) * plan.seat;
  const months = billedMonths(days);
  return { monthly, months, total: monthly * months };
}

/** The amount in a price the owner typed ("250,000 IQD", "٢٥٠٠٠٠") — 0 if none. */
export function priceNumber(text: string): number {
  const d = String(text ?? "")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[,،٬\s]/g, "")
    .match(/\d+(\.\d+)?/);
  return d ? Number(d[0]) : 0;
}

export const money = (n: number) => Math.round(n).toLocaleString("en-US");

/** Money received per month (by the day it was marked paid), newest first; and what is still owed. */
export function finance(rows: PanelRow[]): { months: { month: string; total: number; count: number }[]; paid: number; unpaid: number; unpaidCount: number } {
  const by = new Map<string, { total: number; count: number }>();
  let paid = 0, unpaid = 0, unpaidCount = 0;
  for (const r of rows) {
    const n = priceNumber(r.price);
    if (r.paid && r.paid_at) {
      const m = new Date(r.paid_at).toISOString().slice(0, 7);
      const cur = by.get(m) ?? { total: 0, count: 0 };
      by.set(m, { total: cur.total + n, count: cur.count + 1 });
      paid += n;
    } else if (!r.paid && !r.is_trial) {
      unpaid += n;
      unpaidCount++;
    }
  }
  const months = [...by.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([month, v]) => ({ month, ...v }));
  return { months, paid, unpaid, unpaidCount };
}

/** A receipt's number: the month it was paid and the code's last four. */
export const receiptNo = (r: PanelRow) => `R-${new Date(r.paid_at ?? r.created_at).toISOString().slice(0, 7).replace("-", "")}-${r.code_hint}`;

// ── Messages the owner sends (WhatsApp) ─────────────────────────────────────
type T = (k: string) => string;
const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** The first message: the code and how to enter it. */
export function activationMessage(o: { company: string; code: string; days: number; seats: number; stations: string[]; contact: string }, t: T): string {
  return [
    `${t("Hello")} ${o.company}`,
    `${t("Your activation code")}: ${o.code}`,
    `${t("Period")}: ${o.days} ${t("days from the first computer")} · ${t("Computers")}: ${o.seats}`,
    `${t("Stations")}: ${o.stations.join("، ")}`,
    "",
    t("To activate:"),
    `1. ${t("Open the program on the computer (it needs the internet this once).")}`,
    `2. ${t("The activation window appears: type the code and press «Activate».")}`,
    `3. ${t("Sign in with the same code to open the whole system, then make your staff's accounts.")}`,
    ...(o.contact ? ["", `${t("For help")}: ${o.contact}`] : []),
  ].join("\n");
}

/** A reminder before the end of the period (or after it). */
export function reminderMessage(r: PanelRow, now: number, t: T): string {
  const left = timeLeft(r, now);
  const when = r.expires_at == null ? "" : left && left.days > 0
    ? `${t("Your subscription ends on")} ${ymd(r.expires_at)} (${left.days} ${t("days left")}).`
    : `${t("Your subscription ended on")} ${ymd(r.expires_at)}.`;
  return [
    `${t("Hello")} ${r.company}`,
    when,
    t("To renew it and keep working without a stop, contact us."),
    ...(r.price ? [`${t("Renewal")}: ${r.price}`] : []),
  ].filter(Boolean).join("\n");
}
