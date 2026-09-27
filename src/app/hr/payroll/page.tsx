import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { getBranding } from "@/lib/branding";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { PrintButton } from "@/components/print/PrintButton";
import { hrAdvances, hrContext, hrEmployees, hrSettings } from "@/lib/hr/data";
import { addDays, daysInMonth, hoursLabel, payroll, payrollTotals } from "@/lib/hr/core";
import { HrTabs, money } from "@/components/hr/parts";

export const dynamic = "force-dynamic";

/**
 * The month's payroll sheet: base salary, less the advances set against the
 * month, and — when the rules say so — a day's pay for each absent or
 * unpaid-leave day. Printable.
 */
export default async function PayrollPage({ searchParams }: { searchParams?: { month?: string } }) {
  const locale = getLocale();
  const month = searchParams?.month && /^\d{4}-\d{2}$/.test(searchParams.month) ? searchParams.month : localDate().slice(0, 7);
  const last = `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
  const [people, settings, advances, ctx, brand] = await Promise.all([
    hrEmployees(), hrSettings(), hrAdvances(month), hrContext(`${month}-01`, last), getBranding(),
  ]);
  const rows = payroll(people, month, ctx, advances, settings);
  const cur = new Map(people.map((p) => [p.id, p.currency]));
  const currencies = new Set(rows.map((r) => cur.get(r.employee.id) ?? "IQD"));
  const tot = payrollTotals(rows);
  const oneCurrency = currencies.size <= 1 ? [...currencies][0] ?? "IQD" : null;

  return (
    <div className="space-y-5">
      <HrTabs active="/hr/payroll" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Payroll")}</h1>
        <div className="no-print flex items-center gap-2 text-sm">
          <Link href={`/hr/payroll?month=${addDays(`${month}-01`, -1).slice(0, 7)}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Previous month")}</Link>
          <span className="rounded-md bg-surface-gray-1 px-3 py-1.5 font-semibold tabular-nums" dir="ltr">{month}</span>
          <Link href={`/hr/payroll?month=${addDays(last, 1).slice(0, 7)}`} className="rounded-md border border-outline-gray-2 px-2.5 py-1.5 hover:bg-surface-gray-1">{t(locale, "Next month")}</Link>
          <PrintButton />
        </div>
      </div>
      <div className="hidden text-center print:block">
        <div className="text-lg font-bold">{brand.companyName || "Spir-Margin"}</div>
        <div className="text-sm">{t(locale, "Payroll")} — <span dir="ltr">{month}</span></div>
      </div>
      <p className="no-print text-xs text-ink-gray-5">
        {settings.deduct_absence
          ? t(locale, "Absent and unpaid-leave days are deducted at a day's pay (the salary ÷ 30).")
          : t(locale, "Absences are shown but not deducted. Change this in «Shifts & rules».")}
      </p>
      <Panel title={`${t(locale, "Payroll sheet")} (${rows.length})`}>
        {rows.length === 0 ? <EmptyRow text={t(locale, "No employees yet")} actionHref="/hr/employees/new" actionLabel={t(locale, "New employee")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="payroll-table">
              <thead><tr className="text-xs text-ink-gray-4">
                {["Employee", "Base salary", "Absent", "Unpaid leave", "Late (h:mm)", "Advances", "Deductions", "Net pay"].map((h) => <th key={h} className="px-3 py-2 text-start">{t(locale, h)}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-outline-gray-1 tabular-nums">
                {rows.map((r) => {
                  const c = cur.get(r.employee.id) ?? "IQD";
                  return (
                    <tr key={r.employee.id} data-employee={r.employee.full_name}>
                      <td className="px-3 py-2 font-medium">{r.employee.full_name}</td>
                      <td className="px-3 py-2" dir="ltr">{money(r.base, c)}</td>
                      <td className="px-3 py-2">{r.absent}</td>
                      <td className="px-3 py-2">{r.unpaid}</td>
                      <td className="px-3 py-2" dir="ltr">{hoursLabel(r.lateMin)}</td>
                      <td className="px-3 py-2" dir="ltr">{money(r.advances, c)}</td>
                      <td className="px-3 py-2" dir="ltr">{money(r.deduction, c)}</td>
                      <td className="px-3 py-2 font-bold" dir="ltr" data-net>{money(r.net, c)}</td>
                    </tr>
                  );
                })}
              </tbody>
              {oneCurrency && (
                <tfoot><tr className="border-t-2 border-outline-gray-3 font-semibold tabular-nums">
                  <td className="px-3 py-2">{t(locale, "Total")}</td>
                  <td className="px-3 py-2" dir="ltr">{money(tot.base, oneCurrency)}</td>
                  <td colSpan={3} />
                  <td className="px-3 py-2" dir="ltr">{money(tot.advances, oneCurrency)}</td>
                  <td className="px-3 py-2" dir="ltr">{money(tot.deduction, oneCurrency)}</td>
                  <td className="px-3 py-2" dir="ltr">{money(tot.net, oneCurrency)}</td>
                </tr></tfoot>
              )}
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
