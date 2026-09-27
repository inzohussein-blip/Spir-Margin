import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import type { DayStatus } from "@/lib/hr/core";

/** The staff station's pages, one row of tabs (the sidebar has them too). */
export const HR_PAGES: [string, string][] = [
  ["/hr/attendance", "Attendance"],
  ["/hr/roster", "Roster"],
  ["/hr/employees", "Employees"],
  ["/hr/leaves", "Leaves"],
  ["/hr/advances", "Advances"],
  ["/hr/payroll", "Payroll"],
  ["/hr/shifts", "Shifts & rules"],
];

export function HrTabs({ active }: { active: string }) {
  const locale = getLocale();
  return (
    <nav className="no-print -mx-1 flex gap-1 overflow-x-auto pb-1 text-sm" aria-label={t(locale, "Staff & shifts")}>
      {HR_PAGES.map(([href, label]) => (
        <Link key={href} href={href} aria-current={href === active ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-3 py-1.5 font-medium ${href === active ? "bg-emerald-600 text-white" : "text-ink-gray-6 hover:bg-surface-gray-2"}`}>
          {t(locale, label)}
        </Link>
      ))}
    </nav>
  );
}

const TONE: Record<DayStatus, string> = {
  present: "bg-emerald-50 text-emerald-700 border-emerald-200",
  late: "bg-amber-50 text-amber-800 border-amber-200",
  absent: "bg-red-50 text-red-700 border-red-200",
  leave: "bg-sky-50 text-sky-700 border-sky-200",
  off: "bg-surface-gray-1 text-ink-gray-6 border-outline-gray-2",
  pending: "bg-surface-gray-1 text-ink-gray-6 border-outline-gray-2",
  unscheduled: "bg-surface-gray-1 text-ink-gray-5 border-outline-gray-2",
  replaced: "bg-violet-50 text-violet-700 border-violet-200",
};
const LABEL: Record<DayStatus, string> = {
  present: "Present", late: "Late", absent: "Absent", leave: "On leave", off: "Rest day",
  pending: "Not arrived yet", unscheduled: "Not rostered", replaced: "Covered",
};

export function StatusBadge({ status, lateMin = 0 }: { status: DayStatus; lateMin?: number }) {
  const locale = getLocale();
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${TONE[status]}`} data-status={status}>
      {t(locale, LABEL[status])}
      {status === "late" && lateMin > 0 && <span className="tabular-nums" dir="ltr">+{lateMin}{t(locale, "min")}</span>}
    </span>
  );
}

export const money = (n: number, currency = "IQD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "IQD" ? 0 : 2 }).format(n || 0);
