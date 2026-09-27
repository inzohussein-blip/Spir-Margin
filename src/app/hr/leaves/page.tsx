import { Trash2Icon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Field, TextInput, Select, SubmitButton } from "@/components/form/Fields";
import { createLeave, deleteLeave } from "@/app/actions/hr";
import { hrEmployees, hrSettings } from "@/lib/hr/data";
import { LEAVE_TYPES, leaveBalance, leaveDays, type Leave } from "@/lib/hr/core";
import { HrTabs } from "@/components/hr/parts";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { annual: "Annual leave", sick: "Sick leave", emergency: "Emergency leave", unpaid: "Unpaid leave" };

export default async function LeavesPage({ searchParams }: { searchParams?: { year?: string } }) {
  const locale = getLocale();
  const today = localDate();
  const year = searchParams?.year && /^\d{4}$/.test(searchParams.year) ? searchParams.year : today.slice(0, 4);
  const [people, settings, res] = await Promise.all([
    hrEmployees(),
    hrSettings(),
    createClient().from("hr_leaves").select("id, employee_id, leave_type, from_date, to_date, note")
      .lte("from_date", `${year}-12-31`).gte("to_date", `${year}-01-01`).order("from_date", { ascending: false }),
  ]);
  const leaves = ((res.data as (Leave & { id: string; note: string | null })[] | null) ?? []);
  const names = new Map(people.map((p) => [p.id, p.full_name]));
  const active = people.filter((p) => p.is_active);

  return (
    <div className="space-y-5">
      <HrTabs active="/hr/leaves" />
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Leaves")} <span className="text-base font-normal tabular-nums text-ink-gray-5">{year}</span></h1>

      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-ink-gray-8">{t(locale, "New leave")}</h2>
          <ValidatedForm action={createLeave} className="space-y-3">
            <Field label={t(locale, "Employee")} required>
              <Select name="employee_id" required defaultValue="">
                <option value="" disabled>—</option>
                {active.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </Select>
            </Field>
            <Field label={t(locale, "Kind of leave")} required>
              <Select name="leave_type" defaultValue="annual">
                {LEAVE_TYPES.map((k) => <option key={k} value={k}>{t(locale, TYPE_LABEL[k])}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(locale, "From")} required><TextInput name="from_date" type="date" required defaultValue={today} /></Field>
              <Field label={t(locale, "To")} required><TextInput name="to_date" type="date" required defaultValue={today} /></Field>
            </div>
            <Field label={t(locale, "Note")}><TextInput name="note" /></Field>
            <SubmitButton>{t(locale, "Record the leave")}</SubmitButton>
          </ValidatedForm>
        </div>

        <div className="space-y-5">
          <Panel title={`${t(locale, "Annual leave balance")} (${settings.annual_leave_days} ${t(locale, "days a year")})`}>
            {active.length === 0 ? <EmptyRow text={t(locale, "No employees yet")} /> : (
              <div className="flex flex-wrap gap-2 p-2" data-testid="leave-balances">
                {active.map((p) => {
                  const b = leaveBalance(leaves, p.id, year, settings.annual_leave_days);
                  return (
                    <span key={p.id} className="rounded-lg border border-outline-gray-2 px-3 py-1.5 text-sm">
                      {p.full_name}: <b className={`tabular-nums ${b.remaining < 0 ? "text-red-600" : ""}`}>{b.remaining}</b>
                      <span className="text-xs text-ink-gray-5"> ({t(locale, "used")} {b.used})</span>
                    </span>
                  );
                })}
              </div>
            )}
          </Panel>
          <Panel title={`${t(locale, "All leaves")} (${leaves.length})`}>
            {leaves.length === 0 ? <EmptyRow text={t(locale, "No leaves recorded this year")} /> : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="leaves-table">
                  <thead><tr className="text-xs text-ink-gray-4">
                    {["Employee", "Kind of leave", "From", "To", "Days", "Note", ""].map((h, i) => <th key={i} className="px-3 py-2 text-start">{h && t(locale, h)}</th>)}
                  </tr></thead>
                  <tbody className="divide-y divide-outline-gray-1">
                    {leaves.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2 font-medium">{names.get(l.employee_id) ?? "—"}</td>
                        <td className="px-3 py-2">{t(locale, TYPE_LABEL[l.leave_type])}</td>
                        <td className="px-3 py-2 tabular-nums" dir="ltr">{l.from_date}</td>
                        <td className="px-3 py-2 tabular-nums" dir="ltr">{l.to_date}</td>
                        <td className="px-3 py-2 tabular-nums">{leaveDays(l)}</td>
                        <td className="px-3 py-2 text-ink-gray-5">{l.note ?? ""}</td>
                        <td className="px-3 py-2">
                          <ValidatedForm action={deleteLeave}>
                            <input type="hidden" name="id" value={l.id} />
                            <button aria-label={t(locale, "Delete")} title={t(locale, "Delete")} className="rounded p-1 text-ink-gray-4 hover:bg-red-50 hover:text-red-600"><Trash2Icon size={14} /></button>
                          </ValidatedForm>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
