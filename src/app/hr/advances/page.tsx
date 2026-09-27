import { Trash2Icon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Field, TextInput, Select, SubmitButton } from "@/components/form/Fields";
import { createAdvance, deleteAdvance } from "@/app/actions/hr";
import { hrAdvances, hrEmployees } from "@/lib/hr/data";
import { HrTabs, money } from "@/components/hr/parts";

export const dynamic = "force-dynamic";

export default async function AdvancesPage() {
  const locale = getLocale();
  const today = localDate();
  const [people, advances] = await Promise.all([hrEmployees(), hrAdvances()]);
  const byId = new Map(people.map((p) => [p.id, p]));
  return (
    <div className="space-y-5">
      <HrTabs active="/hr/advances" />
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Advances")}</h1>
      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-ink-gray-8">{t(locale, "New advance")}</h2>
          <ValidatedForm action={createAdvance} className="space-y-3">
            <Field label={t(locale, "Employee")} required>
              <Select name="employee_id" required defaultValue="">
                <option value="" disabled>—</option>
                {people.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>
            </Field>
            <Field label={t(locale, "Amount")} required><TextInput name="amount" type="number" min="0" step="any" required dir="ltr" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(locale, "Date")}><TextInput name="advance_date" type="date" defaultValue={today} /></Field>
              <Field label={t(locale, "Deducted from the salary of")}><TextInput name="deduct_month" type="month" defaultValue={today.slice(0, 7)} /></Field>
            </div>
            <Field label={t(locale, "Note")}><TextInput name="note" /></Field>
            <SubmitButton>{t(locale, "Record the advance")}</SubmitButton>
          </ValidatedForm>
        </div>
        <Panel title={`${t(locale, "All advances")} (${advances.length})`}>
          {advances.length === 0 ? <EmptyRow text={t(locale, "No advances yet")} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="advances-table">
                <thead><tr className="text-xs text-ink-gray-4">
                  {["Employee", "Date", "Amount", "Deducted in", "Note", ""].map((h, i) => <th key={i} className="px-3 py-2 text-start">{h && t(locale, h)}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-outline-gray-1">
                  {advances.map((a) => {
                    const p = byId.get(a.employee_id);
                    return (
                      <tr key={a.id}>
                        <td className="px-3 py-2 font-medium">{p?.full_name ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums" dir="ltr">{a.advance_date}</td>
                        <td className="px-3 py-2 tabular-nums" dir="ltr">{money(a.amount, p?.currency)}</td>
                        <td className="px-3 py-2 tabular-nums" dir="ltr">{a.deduct_month}</td>
                        <td className="px-3 py-2 text-ink-gray-5">{a.note ?? ""}</td>
                        <td className="px-3 py-2">
                          <ValidatedForm action={deleteAdvance}>
                            <input type="hidden" name="id" value={a.id} />
                            <button aria-label={t(locale, "Delete")} title={t(locale, "Delete")} className="rounded p-1 text-ink-gray-4 hover:bg-red-50 hover:text-red-600"><Trash2Icon size={14} /></button>
                          </ValidatedForm>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
