"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveInstallationNote, type InstallationNoteInput } from "@/app/actions/installation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Opt { id: string; label: string; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function InstallationNoteForm({
  labs,
  devices,
}: {
  labs: Opt[];
  devices: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit } = useForm<InstallationNoteInput>({
    defaultValues: {
      inst_no: "",
      lab_id: "",
      inst_date: new Date().toISOString().slice(0, 10),
      inst_time: "",
      remarks: "",
      items: [{ device_id: "", serial_no: "", qty: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  function onSubmit(values: InstallationNoteInput) {
    start(async () => {
      const res = await saveInstallationNote({ ...values, lab_id: values.lab_id || null });
      if (res.ok) router.push("/installation-notes");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Installation Note</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">Note no.</span>
            <input {...register("inst_no")} className={cls} placeholder="IN-0001" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Lab</span>
            <select {...register("lab_id")} className={cls}>
              <option value="">— none —</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Install date</span>
            <input type="date" {...register("inst_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Time</span>
            <input type="time" {...register("inst_time")} className={cls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">Remarks</span>
            <input {...register("remarks")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Devices installed</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="col-span-3 block text-xs">
                  <span className="text-ink-gray-5">Device</span>
                  <select {...register(`items.${i}.device_id`)} className={cls}>
                    <option value="">Select…</option>
                    {devices.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </label>
                <label className="col-span-2 block text-xs">
                  <span className="text-ink-gray-5">Serial no.</span>
                  <input {...register(`items.${i}.serial_no`)} className={cls} />
                </label>
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ device_id: "", serial_no: "", qty: 1 })}>
            <PlusIcon size={14} className="mr-1" /> Add device
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        Create note (draft)
      </Button>
    </form>
  );
}
