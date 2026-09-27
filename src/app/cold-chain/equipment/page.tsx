import Link from "next/link";
import { WrenchIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Field, TextInput, SubmitButton } from "@/components/form/Fields";
import { createEquipment } from "@/app/actions/coldchain";
import { calibrationDue, taskDue, type Freq } from "@/lib/coldchain/core";
import { CcTabs } from "@/components/coldchain/parts";

export const dynamic = "force-dynamic";

interface Eq { id: string; name: string; model: string | null; serial_no: string | null; location: string | null; calib_months: number | null; last_calibrated: string | null; is_active: boolean }
interface Task { equipment_id: string; freq: Freq; last_done: string | null }

export default async function EquipmentPage() {
  const locale = getLocale();
  const today = localDate();
  const supabase = createClient();
  const [eq, tasks] = await Promise.all([
    supabase.from("cc_equipment").select("id, name, model, serial_no, location, calib_months, last_calibrated, is_active").order("name"),
    supabase.from("cc_equipment_tasks").select("equipment_id, freq, last_done"),
  ]);
  const list = (eq.data as Eq[] | null) ?? [];
  const allTasks = (tasks.data as Task[] | null) ?? [];
  return (
    <div className="space-y-5">
      <CcTabs active="/cold-chain/equipment" />
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Instruments & calibration")}</h1>
      <div className="grid gap-5 lg:grid-cols-[22rem_1fr]">
        <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
          <h2 className="mb-3 font-semibold text-ink-gray-8">{t(locale, "Add an instrument")}</h2>
          <ValidatedForm action={createEquipment} className="space-y-3">
            <Field label={t(locale, "Name")} required><TextInput name="name" required placeholder={t(locale, "Calibrated thermometer")} /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(locale, "Model")}><TextInput name="model" /></Field>
              <Field label={t(locale, "Serial number")}><TextInput name="serial_no" dir="ltr" /></Field>
            </div>
            <Field label={t(locale, "Location")}><TextInput name="location" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(locale, "Calibrate every (months)")}><TextInput name="calib_months" type="number" min="1" max="120" dir="ltr" /></Field>
              <Field label={t(locale, "Last calibrated")}><TextInput name="last_calibrated" type="date" /></Field>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(locale, "Service company")}><TextInput name="vendor" /></Field>
              <Field label={t(locale, "Its phone")}><TextInput name="vendor_phone" dir="ltr" /></Field>
            </div>
            <SubmitButton>{t(locale, "Add")}</SubmitButton>
          </ValidatedForm>
        </div>
        <Panel title={`${t(locale, "Instruments")} (${list.length})`}>
          {list.length === 0 ? <EmptyRow icon={<WrenchIcon size={20} />} text={t(locale, "No instruments yet")} hint={t(locale, "Thermometers, pipettes, centrifuges, test equipment — anything the company must keep calibrated.")} /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="equipment-table">
                <thead><tr className="text-xs text-ink-gray-4">
                  {["Name", "Location", "Next calibration", "Tasks due"].map((h) => <th key={h} className="px-3 py-2 text-start">{t(locale, h)}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-outline-gray-1">
                  {list.map((e) => {
                    const cal = calibrationDue(e.last_calibrated, e.calib_months, today);
                    const due = allTasks.filter((x) => x.equipment_id === e.id && taskDue(x.freq, x.last_done, today).due).length;
                    return (
                      <tr key={e.id} className={e.is_active ? "" : "opacity-50"}>
                        <td className="px-3 py-2 font-medium"><Link href={`/cold-chain/equipment/${e.id}`} className="text-brand hover:underline">{e.name}</Link>
                          {e.serial_no && <span className="ms-1 text-xs text-ink-gray-5" dir="ltr">{e.serial_no}</span>}</td>
                        <td className="px-3 py-2 text-ink-gray-6">{e.location ?? "—"}</td>
                        <td className={`px-3 py-2 tabular-nums ${cal && cal.daysLeft < 0 ? "font-semibold text-red-600" : cal && cal.daysLeft <= 30 ? "text-amber-700" : ""}`} dir="ltr" data-calibration>
                          {cal ? `${cal.next} (${cal.daysLeft})` : "—"}
                        </td>
                        <td className={`px-3 py-2 tabular-nums ${due ? "font-semibold text-amber-700" : "text-ink-gray-5"}`}>{due}</td>
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
