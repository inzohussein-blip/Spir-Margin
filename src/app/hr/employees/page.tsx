import Link from "next/link";
import { PlusIcon, UsersIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { hrEmployees } from "@/lib/hr/data";
import { HrTabs, money } from "@/components/hr/parts";

export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const locale = getLocale();
  const people = await hrEmployees();
  return (
    <div className="space-y-5">
      <HrTabs active="/hr/employees" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Employees")}</h1>
        <Link href="/hr/employees/new" className="inline-flex items-center gap-1.5 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          <PlusIcon size={15} /> {t(locale, "New employee")}
        </Link>
      </div>
      <Panel title={`${t(locale, "All employees")} (${people.length})`}>
        {people.length === 0 ? (
          <EmptyRow icon={<UsersIcon size={20} />} text={t(locale, "No employees yet")} hint={t(locale, "Add the company's staff, then put them on shifts in the roster.")} actionHref="/hr/employees/new" actionLabel={t(locale, "New employee")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-ink-gray-4">
                  {["Name", "Job title", "Department", "Phone", "Hire date", "Base salary"].map((h) => <th key={h} className="px-4 py-2 text-start">{t(locale, h)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {people.map((e) => (
                  <tr key={e.id} className={e.is_active ? "" : "opacity-50"}>
                    <td className="px-4 py-2 font-medium">
                      <span className="me-2 inline-block size-2.5 rounded-full align-middle" style={{ background: e.color }} />
                      <Link href={`/hr/employees/${e.id}`} className="text-brand hover:underline">{e.full_name}</Link>
                      {!e.is_active && <span className="ms-2 text-xs text-ink-gray-5">({t(locale, "left")})</span>}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{e.job_title ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{e.department ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5 tabular-nums" dir="ltr">{e.phone ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5 tabular-nums" dir="ltr">{e.hire_date ?? "—"}</td>
                    <td className="px-4 py-2 tabular-nums" dir="ltr">{money(e.base_salary, e.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
