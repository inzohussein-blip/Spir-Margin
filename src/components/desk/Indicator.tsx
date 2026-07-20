import type { ReactNode } from "react";
import { tStatus, DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

/**
 * ERPNext-style status indicator: a small colored dot + label, exactly like the
 * Frappe Desk list "indicator". Map a status to a color name, or pass one.
 */

export type IndicatorColor =
  | "gray" | "blue" | "green" | "red" | "orange" | "amber" | "purple" | "cyan";

const dot: Record<IndicatorColor, string> = {
  gray: "bg-ink-gray-4",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  purple: "bg-violet-500",
  cyan: "bg-cyan-500",
};

// Sensible defaults for the status vocabularies used across the app.
const statusColor: Record<string, IndicatorColor> = {
  draft: "gray", open: "orange", unsigned: "gray", pending: "orange", planned: "blue",
  submitted: "blue", confirmed: "blue", replied: "blue", in_process: "amber",
  in_progress: "amber", partly_paid: "blue", partly_completed: "amber", on_hold: "orange",
  active: "green", installed: "green", completed: "green", received: "green", paid: "green",
  resolved: "green", fully_completed: "green", accepted: "green", done: "green",
  unpaid: "amber", overdue: "red", cancelled: "red", rejected: "red", lost: "red",
  stopped: "red", out_of_order: "red", inactive: "gray", closed: "gray", in_stock: "blue",
  in_maintenance: "amber", retired: "gray",
};

export function Indicator({
  status,
  color,
  label,
  locale = DEFAULT_LOCALE,
}: {
  status?: string | null;
  color?: IndicatorColor;
  label?: ReactNode;
  locale?: Locale;
}) {
  const key = (status ?? "").toLowerCase();
  const c = color ?? statusColor[key] ?? "gray";
  const text = label ?? tStatus(locale, key || null);
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-gray-7">
      <span className={`size-2 shrink-0 rounded-full ${dot[c]}`} />
      <span className="capitalize">{text}</span>
    </span>
  );
}
