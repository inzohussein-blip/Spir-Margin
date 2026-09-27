import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { FormCard } from "@/components/form/Fields";
import { EmployeeForm } from "@/components/hr/EmployeeForm";
import { createEmployee } from "@/app/actions/hr";

export const dynamic = "force-dynamic";

export default function NewEmployeePage() {
  const locale = getLocale();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5"><Link href="/hr/employees" className="hover:text-brand"><span aria-hidden>→</span> {t(locale, "Employees")}</Link></div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New employee")}</h1>
      <FormCard title={t(locale, "Employee details")}>
        <EmployeeForm action={createEmployee} submit={t(locale, "Add employee")} />
      </FormCard>
    </div>
  );
}
