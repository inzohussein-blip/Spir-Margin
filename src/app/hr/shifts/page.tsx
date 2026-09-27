import { Trash2Icon, WandSparklesIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Field, TextInput, Select, SubmitButton, Checkbox } from "@/components/form/Fields";
import { addUsualShifts, createShiftType, deleteShiftType, saveHrSettings } from "@/app/actions/hr";
import { hrSettings, hrShifts } from "@/lib/hr/data";
import { HrTabs } from "@/components/hr/parts";

export const dynamic = "force-dynamic";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const COLORS = ["#0ea5e9", "#f59e0b", "#6366f1", "#10b981", "#ef4444", "#8b5cf6"];

export default async function ShiftsPage() {
  const locale = getLocale();
  const [shifts, settings] = await Promise.all([hrShifts(), hrSettings()]);
  return (
    <div className="space-y-5">
      <HrTabs active="/hr/shifts" />
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Shifts & rules")}</h1>
      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={`${t(locale, "Shifts")} (${shifts.length})`}>
          {shifts.length === 0 ? (
            <div className="p-4 text-center">
              <EmptyRow text={t(locale, "There are no shifts yet.")} />
              <ValidatedForm action={addUsualShifts}>
                <button className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700" data-testid="usual-shifts">
                  <WandSparklesIcon size={15} /> {t(locale, "Add the usual three (morning, evening, night)")}
                </button>
              </ValidatedForm>
            </div>
          ) : (
            <ul className="divide-y divide-outline-gray-1" data-testid="shift-list">
              {shifts.map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="size-3 rounded-full" style={{ background: s.color }} />
                  <span className="flex-1 font-medium">{s.name}</span>
                  <span className="tabular-nums text-ink-gray-5" dir="ltr">{s.start_time}–{s.end_time}</span>
                  <ValidatedForm action={deleteShiftType}>
                    <input type="hidden" name="id" value={s.id} />
                    <button aria-label={t(locale, "Delete")} title={t(locale, "Delete")} className="rounded p-1 text-ink-gray-4 hover:bg-red-50 hover:text-red-600"><Trash2Icon size={14} /></button>
                  </ValidatedForm>
                </li>
              ))}
            </ul>
          )}
          <ValidatedForm action={createShiftType} className="grid grid-cols-2 gap-2 border-t border-outline-gray-1 p-3 sm:grid-cols-4">
            <Field label={t(locale, "Name")} required><TextInput name="name" required /></Field>
            <Field label={t(locale, "Starts")} required><TextInput name="start_time" type="time" required defaultValue="08:00" /></Field>
            <Field label={t(locale, "Ends")} required><TextInput name="end_time" type="time" required defaultValue="14:00" /></Field>
            <Field label={t(locale, "Colour")}>
              <Select name="color" defaultValue={COLORS[0]}>{COLORS.map((c, i) => <option key={c} value={c}>{`${t(locale, "Colour")} ${i + 1}`}</option>)}</Select>
            </Field>
            <div className="col-span-full"><SubmitButton>{t(locale, "Add shift")}</SubmitButton></div>
          </ValidatedForm>
        </Panel>

        <Panel title={t(locale, "Rules")}>
          <ValidatedForm action={saveHrSettings} className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <Field label={t(locale, "Minutes of grace before «late»")}><TextInput name="grace_minutes" type="number" min="0" max="240" defaultValue={String(settings.grace_minutes)} dir="ltr" /></Field>
            <Field label={t(locale, "Annual leave days a year")}><TextInput name="annual_leave_days" type="number" min="0" max="365" defaultValue={String(settings.annual_leave_days)} dir="ltr" /></Field>
            <Field label={t(locale, "The week starts on")}>
              <Select name="week_start" defaultValue={String(settings.week_start)}>
                {DAY_NAMES.map((d, i) => <option key={d} value={i}>{t(locale, d)}</option>)}
              </Select>
            </Field>
            <div className="flex items-end pb-2"><Checkbox name="deduct_absence" label={t(locale, "Deduct absent and unpaid-leave days from the salary")} defaultChecked={settings.deduct_absence} /></div>
            <div className="col-span-full"><SubmitButton>{t(locale, "Save the rules")}</SubmitButton></div>
          </ValidatedForm>
        </Panel>
      </div>
    </div>
  );
}
