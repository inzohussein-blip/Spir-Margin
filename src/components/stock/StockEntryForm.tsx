"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveStockEntry, type StockEntryInput } from "@/app/actions/stock_entry";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Opt { id: string; label: string; }
interface BatchOpt extends Opt { avail: number; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function StockEntryForm({
  warehouses,
  batches,
}: {
  warehouses: Opt[];
  batches: BatchOpt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit } = useForm<StockEntryInput>({
    defaultValues: {
      entry_no: "",
      purpose: "transfer",
      posting_date: new Date().toISOString().slice(0, 10),
      from_warehouse: "",
      to_warehouse: "",
      notes: "",
      items: [{ batch_id: "", qty: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const purpose = useWatch({ control, name: "purpose" });

  function onSubmit(values: StockEntryInput) {
    start(async () => {
      const res = await saveStockEntry({
        ...values,
        from_warehouse: values.from_warehouse || null,
        to_warehouse: values.to_warehouse || null,
      });
      if (res.ok) router.push("/stock-entries");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Stock Entry</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">Entry no.</span>
            <input {...register("entry_no")} className={cls} placeholder="STE-0001" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Purpose</span>
            <select {...register("purpose")} className={cls}>
              <option value="receipt">receipt (add stock)</option>
              <option value="issue">issue (remove stock)</option>
              <option value="transfer">transfer (move location)</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Posting date</span>
            <input type="date" {...register("posting_date")} className={cls} />
          </label>
          {purpose !== "receipt" && (
            <label className="block">
              <span className="font-medium text-ink-gray-8">From warehouse</span>
              <select {...register("from_warehouse")} className={cls}>
                <option value="">— none —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </label>
          )}
          {purpose !== "issue" && (
            <label className="block">
              <span className="font-medium text-ink-gray-8">To warehouse</span>
              <select {...register("to_warehouse")} className={cls}>
                <option value="">— none —</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
              </select>
            </label>
          )}
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">Notes</span>
            <input {...register("notes")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Batches</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="col-span-3 block text-xs">
                  <span className="text-ink-gray-5">Batch</span>
                  <select {...register(`items.${i}.batch_id`)} className={cls}>
                    <option value="">Select…</option>
                    {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">Qty</span>
                  <input type="number" step="0.01" {...register(`items.${i}.qty`)} className={cls} />
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">Rate</span>
                  <input type="number" step="0.01" {...register(`items.${i}.rate`)} className={cls} />
                </label>
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ batch_id: "", qty: 1 })}>
            <PlusIcon size={14} className="mr-1" /> Add batch
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        Create entry (draft)
      </Button>
    </form>
  );
}
