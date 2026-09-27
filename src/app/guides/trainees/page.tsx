import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Field, TextInput, Select, SubmitButton } from "@/components/form/Fields";
import { createTrainee } from "@/app/actions/guides";
import { GuideTabs } from "@/components/guides/parts";

export const dynamic = "force-dynamic";

interface Trainee { id: string; full_name: string; employee_id: string | null }
interface Result { trainee_id: string; taken_at: string; score: number; total: number; category: string | null }

export default async function TraineesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const [tr, res, emp] = await Promise.all([
    supabase.from("kb_trainees").select("id, full_name, employee_id").order("full_name"),
    supabase.from("kb_results").select("trainee_id, taken_at, score, total, category").order("taken_at", { ascending: false }).limit(500),
    supabase.from("hr_employees").select("id, full_name").eq("is_active", true).order("full_name"),
  ]);
  const trainees = (tr.data as Trainee[] | null) ?? [];
  const results = (res.data as Result[] | null) ?? [];
  const employees = (emp.data as { id: string; full_name: string }[] | null) ?? [];
  return (
    <div className="space-y-5">
      <GuideTabs active="/guides/trainees" />
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Trainees")}</h1>
      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold">{t(locale, "New trainee")}</h2>
          <ValidatedForm action={createTrainee} className="space-y-3">
            <Field label={t(locale, "Full name")} required><TextInput name="full_name" required /></Field>
            <Field label={t(locale, "Employee")}>
              <Select name="employee_id" defaultValue="">
                <option value="">{t(locale, "— none —")}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
              </Select>
            </Field>
            <SubmitButton>{t(locale, "Add")}</SubmitButton>
          </ValidatedForm>
        </div>
        <Panel title={`${t(locale, "Trainees")} (${trainees.length})`}>
          {trainees.length === 0 ? <EmptyRow text={t(locale, "No trainees yet")} /> : (
            <table className="w-full text-sm" data-testid="trainee-table">
              <thead><tr className="text-xs text-ink-gray-4">
                {["Name", "Quizzes", "Best", "Last"].map((h) => <th key={h} className="px-3 py-2 text-start">{t(locale, h)}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-outline-gray-1 tabular-nums">
                {trainees.map((x) => {
                  const mine = results.filter((r) => r.trainee_id === x.id);
                  const pct = (r: Result) => Math.round((r.score / r.total) * 100);
                  const best = mine.length ? Math.max(...mine.map(pct)) : null;
                  const last = mine[0];
                  return (
                    <tr key={x.id} data-trainee={x.full_name}>
                      <td className="px-3 py-2 font-medium">{x.full_name}</td>
                      <td className="px-3 py-2">{mine.length}</td>
                      <td className="px-3 py-2">{best != null ? `${best}%` : "—"}</td>
                      <td className="px-3 py-2" dir="ltr">{last ? `${last.score}/${last.total} · ${String(last.taken_at).slice(0, 10)}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
