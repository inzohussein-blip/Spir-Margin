"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveDeliveryNote, type DeliveryNoteInput } from "@/app/actions/delivery";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }
interface BatchOpt extends Opt { available: number; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function DeliveryNoteForm({ labs, batches }: { labs: Opt[]; batches: BatchOpt[] }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const { register, control, handleSubmit } = useForm<DeliveryNoteInput>({
    defaultValues: {
      lab_id: "",
      posting_date: new Date().toISOString().slice(0, 10),
      notes: "",
      items: [{ kit_batch_id: "", qty: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  function onSubmit(values: DeliveryNoteInput) {
    start(async () => {
      const res = await saveDeliveryNote(values);
      if (res.ok) router.push("/delivery-notes");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Delivery")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Lab *")}</span>
            <select {...register("lab_id", { required: true })} className={cls}>
              <option value="">{t(locale, "Select…")}</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Posting date")}</span>
            <input type="date" {...register("posting_date")} className={cls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">{t(locale, "Notes")}</span>
            <input {...register("notes")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Kit batches")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <label className="col-span-2 block text-xs sm:col-span-4">
                <span className="text-ink-gray-5">{t(locale, "Batch")}</span>
                <select {...register(`items.${i}.kit_batch_id`)} className={cls}>
                  <option value="">{t(locale, "Select…")}</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.label} — avail {b.available}</option>)}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Qty")}</span>
                <input type="number" step="0.01" {...register(`items.${i}.qty`)} className={cls} />
              </label>
              <div className="flex items-end justify-end">
                <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                  <Trash2Icon size={14} />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ kit_batch_id: "", qty: 1 })}>
            <PlusIcon size={14} className="mr-1" /> Add batch
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Create delivery (draft)")}
      </Button>
    </form>
  );
}
