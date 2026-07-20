"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveMaintenanceVisit, type MaintenanceVisitInput } from "@/app/actions/maintenance";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }
interface DeviceOpt extends Opt { lab_id: string | null; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function MaintenanceVisitForm({
  labs,
  devices,
}: {
  labs: Opt[];
  devices: DeviceOpt[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit, watch } = useForm<MaintenanceVisitInput>({
    defaultValues: {
      visit_no: "",
      lab_id: "",
      visit_date: new Date().toISOString().slice(0, 10),
      maintenance_type: "scheduled",
      completion_status: "full",
      service_person: "",
      customer_feedback: "",
      notes: "",
      purposes: [{ device_id: "", work_done: "", next_due_date: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "purposes" });
  const labId = watch("lab_id");
  const shown = labId ? devices.filter((d) => d.lab_id === labId) : devices;

  function onSubmit(values: MaintenanceVisitInput) {
    start(async () => {
      const res = await saveMaintenanceVisit({ ...values, lab_id: values.lab_id || null });
      if (res.ok) router.push("/maintenance-visits");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Maintenance Visit")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Visit no.")}</span>
            <input {...register("visit_no")} className={cls} placeholder="MV-0001" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Lab")}</span>
            <select {...register("lab_id")} className={cls}>
              <option value="">{t(locale, "— none —")}</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Visit date")}</span>
            <input type="date" {...register("visit_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Time")}</span>
            <input type="time" {...register("visit_time")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Type")}</span>
            <select {...register("maintenance_type")} className={cls}>
              <option value="scheduled">scheduled</option>
              <option value="unscheduled">unscheduled</option>
              <option value="breakdown">breakdown</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Completion")}</span>
            <select {...register("completion_status")} className={cls}>
              <option value="pending">pending</option>
              <option value="partial">partial</option>
              <option value="full">full</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Service person")}</span>
            <input {...register("service_person")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Customer feedback")}</span>
            <input {...register("customer_feedback")} className={cls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">{t(locale, "Notes")}</span>
            <input {...register("notes")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Devices serviced")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="col-span-2 block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Device")}</span>
                  <select {...register(`purposes.${i}.device_id`)} className={cls}>
                    <option value="">{t(locale, "Select…")}</option>
                    {shown.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </label>
                <label className="col-span-2 block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Work done")}</span>
                  <input {...register(`purposes.${i}.work_done`)} className={cls} />
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Next due")}</span>
                  <input type="date" {...register(`purposes.${i}.next_due_date`)} className={cls} />
                </label>
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ device_id: "", work_done: "", next_due_date: "" })}>
            <PlusIcon size={14} className="mr-1" /> Add device
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Create visit (draft)")}
      </Button>
    </form>
  );
}
