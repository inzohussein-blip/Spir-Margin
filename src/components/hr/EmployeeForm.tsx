import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Field, TextInput, TextArea, Select, SubmitButton, Checkbox } from "@/components/form/Fields";
import type { EmployeeRow } from "@/lib/hr/data";

const COLORS = ["#0284c7", "#16a34a", "#d97706", "#db2777", "#7c3aed", "#0d9488", "#dc2626", "#4f46e5"];

/** The employee's card: new or edit (the same fields). */
export function EmployeeForm({ action, employee, submit }: {
  action: (fd: FormData) => Promise<{ error?: string } | void>;
  employee?: EmployeeRow;
  submit: string;
}) {
  const locale = getLocale();
  const e = employee;
  return (
    <ValidatedForm action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label={t(locale, "Full name")} required><TextInput name="full_name" required defaultValue={e?.full_name ?? ""} /></Field>
      <Field label={t(locale, "Employee code")}><TextInput name="code" defaultValue={e?.code ?? ""} dir="ltr" /></Field>
      <Field label={t(locale, "Job title")}><TextInput name="job_title" defaultValue={e?.job_title ?? ""} /></Field>
      <Field label={t(locale, "Department")}><TextInput name="department" defaultValue={e?.department ?? ""} /></Field>
      <Field label={t(locale, "Phone")}><TextInput name="phone" defaultValue={e?.phone ?? ""} dir="ltr" /></Field>
      <Field label={t(locale, "Hire date")}><TextInput name="hire_date" type="date" defaultValue={e?.hire_date ?? ""} /></Field>
      <Field label={t(locale, "Base salary")}><TextInput name="base_salary" type="number" min="0" step="any" defaultValue={String(e?.base_salary ?? 0)} dir="ltr" /></Field>
      <Field label={t(locale, "Currency")}>
        <Select name="currency" defaultValue={e?.currency ?? "IQD"}>
          <option value="IQD">{t(locale, "Iraqi dinar")}</option>
          <option value="USD">{t(locale, "US dollar")}</option>
        </Select>
      </Field>
      <Field label={t(locale, "Colour on the roster")}>
        <Select name="color" defaultValue={e?.color ?? COLORS[0]}>
          {COLORS.map((c, i) => <option key={c} value={c}>{`${t(locale, "Colour")} ${i + 1}`}</option>)}
        </Select>
      </Field>
      {e && (
        <div className="flex items-end pb-2"><Checkbox name="is_active" label={t(locale, "Still working here")} defaultChecked={e.is_active} /></div>
      )}
      <div className="sm:col-span-2"><Field label={t(locale, "Notes")}><TextArea name="notes" defaultValue={e?.notes ?? ""} /></Field></div>
      <div className="sm:col-span-2"><SubmitButton>{submit}</SubmitButton></div>
    </ValidatedForm>
  );
}
