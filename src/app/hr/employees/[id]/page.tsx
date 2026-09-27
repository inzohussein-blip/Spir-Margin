import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { FormCard } from "@/components/form/Fields";
import { EmployeeForm } from "@/components/hr/EmployeeForm";
import { updateEmployee } from "@/app/actions/hr";
import { hrContext, hrEmployees, hrSettings } from "@/lib/hr/data";
import { hoursLabel, leaveBalance, monthSummary } from "@/lib/hr/core";

export const dynamic = "force-dynamic";

export default async function EmployeePage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const e = (await hrEmployees()).find((x) => x.id === params.id);
  if (!e) notFound();
  const today = localDate();
  const year = today.slice(0, 4);
  const month = today.slice(0, 7);
  const [settings, ctx] = await Promise.all([hrSettings(), hrContext(`${year}-01-01`, `${year}-12-31`)]);
  const bal = leaveBalance(ctx.leaves, e.id, year, settings.annual_leave_days);
  const m = monthSummary(e.id, month, ctx);
  const action = updateEmployee.bind(null, e.id);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5"><Link href="/hr/employees" className="hover:text-brand"><span aria-hidden>→</span> {t(locale, "Employees")}</Link></div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{e.full_name}</h1>
      <div className="grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4" data-testid="employee-stats">
        {[
          [t(locale, "Annual leave left"), `${bal.remaining} / ${settings.annual_leave_days}`],
          [t(locale, "Days present this month"), String(m.present)],
          [t(locale, "Absent this month"), String(m.absent)],
          [t(locale, "Hours worked this month"), hoursLabel(m.workedMin)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-outline-gray-2 bg-surface-white p-3">
            <div className="text-xs text-ink-gray-5">{k}</div>
            <div className="mt-1 text-lg font-bold tabular-nums" dir="ltr">{v}</div>
          </div>
        ))}
      </div>
      <FormCard title={t(locale, "Employee details")}>
        <EmployeeForm action={action} employee={e} submit={t(locale, "Save changes")} />
      </FormCard>
    </div>
  );
}
