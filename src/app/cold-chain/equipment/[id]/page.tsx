import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon, Trash2Icon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Field, TextInput, Select, SubmitButton, Checkbox } from "@/components/form/Fields";
import { addLog, addTask, deleteTask, taskDone } from "@/app/actions/coldchain";
import { calibrationDue, FREQS, taskDue, type Freq } from "@/lib/coldchain/core";
import { CcTabs } from "@/components/coldchain/parts";

export const dynamic = "force-dynamic";

const FREQ_LABEL: Record<Freq, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly", quarterly: "Every 3 months", yearly: "Yearly" };
const LOG_LABEL: Record<string, string> = { maintenance: "Maintenance", fault: "Fault", calibration: "Calibration" };

interface Eq { id: string; name: string; model: string | null; serial_no: string | null; location: string | null; vendor: string | null; vendor_phone: string | null; calib_months: number | null; last_calibrated: string | null }
interface Task { id: string; name: string; freq: Freq; last_done: string | null }
interface Log { id: string; log_date: string; log_type: string; details: string; action: string | null; downtime_hours: number | null; resolved: boolean; recorded_by: string | null }

export default async function EquipmentDetail({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const today = localDate();
  const supabase = createClient();
  const [eq, tasks, log] = await Promise.all([
    supabase.from("cc_equipment").select("id, name, model, serial_no, location, vendor, vendor_phone, calib_months, last_calibrated").eq("id", params.id).single(),
    supabase.from("cc_equipment_tasks").select("id, name, freq, last_done").eq("equipment_id", params.id).order("name"),
    supabase.from("cc_equipment_log").select("id, log_date, log_type, details, action, downtime_hours, resolved, recorded_by").eq("equipment_id", params.id).order("log_date", { ascending: false }),
  ]);
  const e = eq.data as Eq | null;
  if (!e) notFound();
  const cal = calibrationDue(e.last_calibrated, e.calib_months, today);
  const taskList = (tasks.data as Task[] | null) ?? [];
  const logList = (log.data as Log[] | null) ?? [];

  return (
    <div className="space-y-5">
      <CcTabs active="/cold-chain/equipment" />
      <div className="text-sm text-ink-gray-5"><Link href="/cold-chain/equipment" className="hover:text-brand"><span aria-hidden>→</span> {t(locale, "Instruments & calibration")}</Link></div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{e.name}</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {[e.model, e.serial_no, e.location, e.vendor && `${e.vendor}${e.vendor_phone ? ` · ${e.vendor_phone}` : ""}`].filter(Boolean).map((x) => (
          <span key={String(x)} className="rounded-md bg-surface-gray-1 px-2.5 py-1">{x}</span>
        ))}
        {cal && (
          <span className={`rounded-md px-2.5 py-1 ${cal.daysLeft < 0 ? "bg-red-50 text-red-700" : cal.daysLeft <= 30 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`} data-testid="calibration">
            {t(locale, "Next calibration")}: <span dir="ltr" className="tabular-nums">{cal.next}</span>
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t(locale, "Routine tasks")}>
          {taskList.length === 0 ? <EmptyRow text={t(locale, "No tasks yet")} /> : (
            <ul className="divide-y divide-outline-gray-1" data-testid="task-list">
              {taskList.map((k) => {
                const d = taskDue(k.freq, k.last_done, today);
                return (
                  <li key={k.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <span className="flex-1">{k.name} <span className="text-xs text-ink-gray-5">({t(locale, FREQ_LABEL[k.freq])})</span></span>
                    <span className={`text-xs tabular-nums ${d.due ? "font-semibold text-amber-700" : "text-ink-gray-5"}`} dir="ltr" data-due={d.due ? "1" : "0"}>{k.last_done ?? "—"}</span>
                    <ValidatedForm action={taskDone}>
                      <input type="hidden" name="id" value={k.id} /><input type="hidden" name="equipment_id" value={e.id} />
                      <button className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1 text-xs font-semibold text-white hover:bg-emerald-700"><CheckIcon size={12} /> {t(locale, "Done today")}</button>
                    </ValidatedForm>
                    <ValidatedForm action={deleteTask}>
                      <input type="hidden" name="id" value={k.id} /><input type="hidden" name="equipment_id" value={e.id} />
                      <button aria-label={t(locale, "Delete")} title={t(locale, "Delete")} className="rounded p-1 text-ink-gray-4 hover:bg-red-50 hover:text-red-600"><Trash2Icon size={13} /></button>
                    </ValidatedForm>
                  </li>
                );
              })}
            </ul>
          )}
          <ValidatedForm action={addTask} className="flex flex-wrap items-end gap-2 border-t border-outline-gray-1 p-3">
            <input type="hidden" name="equipment_id" value={e.id} />
            <div className="min-w-40 flex-1"><Field label={t(locale, "Task")}><TextInput name="name" required /></Field></div>
            <Field label={t(locale, "How often")}>
              <Select name="freq" defaultValue="weekly">{FREQS.map((f) => <option key={f} value={f}>{t(locale, FREQ_LABEL[f])}</option>)}</Select>
            </Field>
            <SubmitButton>{t(locale, "Add")}</SubmitButton>
          </ValidatedForm>
        </Panel>

        <Panel title={t(locale, "Maintenance, faults and calibration")}>
          <ValidatedForm action={addLog} className="grid grid-cols-2 gap-2 border-b border-outline-gray-1 p-3">
            <input type="hidden" name="equipment_id" value={e.id} />
            <Field label={t(locale, "Kind")}>
              <Select name="log_type" defaultValue="maintenance">{Object.entries(LOG_LABEL).map(([k, v]) => <option key={k} value={k}>{t(locale, v)}</option>)}</Select>
            </Field>
            <Field label={t(locale, "Date")}><TextInput name="log_date" type="date" defaultValue={today} /></Field>
            <div className="col-span-2"><Field label={t(locale, "What happened")} required><TextInput name="details" required /></Field></div>
            <Field label={t(locale, "What was done")}><TextInput name="action" /></Field>
            <Field label={t(locale, "Hours out of service")}><TextInput name="downtime_hours" type="number" min="0" step="any" dir="ltr" /></Field>
            <div className="col-span-2 flex items-center justify-between">
              <Checkbox name="resolved" label={t(locale, "Resolved")} defaultChecked />
              <SubmitButton>{t(locale, "Save entry")}</SubmitButton>
            </div>
          </ValidatedForm>
          {logList.length === 0 ? <EmptyRow text={t(locale, "Nothing recorded yet")} /> : (
            <ul className="divide-y divide-outline-gray-1" data-testid="log-list">
              {logList.map((l) => (
                <li key={l.id} className="px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${l.log_type === "fault" ? (l.resolved ? "bg-amber-50 text-amber-800" : "bg-red-50 text-red-700") : l.log_type === "calibration" ? "bg-cyan-50 text-cyan-700" : "bg-surface-gray-1 text-ink-gray-6"}`}>{t(locale, LOG_LABEL[l.log_type])}</span>
                    <span className="tabular-nums text-xs text-ink-gray-5" dir="ltr">{String(l.log_date).slice(0, 10)}</span>
                    {l.recorded_by && <span className="text-xs text-ink-gray-5">· {l.recorded_by}</span>}
                  </div>
                  <div className="mt-1">{l.details}{l.action ? <span className="text-ink-gray-6"> — {l.action}</span> : null}</div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
