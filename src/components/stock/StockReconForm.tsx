"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveStockReconciliation, type StockReconInput } from "@/app/actions/stock";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface BatchOpt { id: string; label: string; available: number; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function StockReconForm({ batches }: { batches: BatchOpt[] }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const { register, control, handleSubmit } = useForm<StockReconInput>({
    defaultValues: {
      posting_date: new Date().toISOString().slice(0, 10),
      notes: "",
      items: [{ kit_batch_id: "", counted_qty: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  function onSubmit(values: StockReconInput) {
    start(async () => {
      const res = await saveStockReconciliation(values);
      if (res.ok) router.push("/stock-reconciliation");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Physical count")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Posting date")}</span>
            <input type="date" {...register("posting_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Notes")}</span>
            <input {...register("notes")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Counted batches")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <label className="col-span-2 block text-xs sm:col-span-4">
                <span className="text-ink-gray-5">{t(locale, "Kit batch")}</span>
                <select {...register(`items.${i}.kit_batch_id`)} className={cls}>
                  <option value="">{t(locale, "Select…")}</option>
                  {batches.map((b) => <option key={b.id} value={b.id}>{b.label} — now {b.available}</option>)}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Counted qty")}</span>
                <input type="number" step="0.01" {...register(`items.${i}.counted_qty`)} className={cls} />
              </label>
              <div className="flex items-end justify-end">
                <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                  <Trash2Icon size={14} />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ kit_batch_id: "", counted_qty: 0 })}>
            <PlusIcon size={14} className="mr-1" /> Add batch
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Create count (draft)")}
      </Button>
    </form>
  );
}
