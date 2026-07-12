"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveQualityInspection, type QualityInspectionInput } from "@/app/actions/quality";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Opt { id: string; label: string; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function QualityInspectionForm({
  products,
  batches,
}: {
  products: Opt[];
  batches: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit } = useForm<QualityInspectionInput>({
    defaultValues: {
      qi_no: "",
      report_date: new Date().toISOString().slice(0, 10),
      inspection_type: "incoming",
      product_id: "",
      batch_id: "",
      sample_size: 1,
      inspected_by: "",
      remarks: "",
      readings: [{ parameter: "", reading_value: "", min_value: "", max_value: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "readings" });

  function onSubmit(values: QualityInspectionInput) {
    start(async () => {
      const res = await saveQualityInspection({
        ...values,
        product_id: values.product_id || null,
        batch_id: values.batch_id || null,
      });
      if (res.ok) router.push("/quality-inspections");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Quality Inspection</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">QI no.</span>
            <input {...register("qi_no")} className={cls} placeholder="QI-0001" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Report date</span>
            <input type="date" {...register("report_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Inspection type</span>
            <select {...register("inspection_type")} className={cls}>
              <option value="incoming">incoming</option>
              <option value="outgoing">outgoing</option>
              <option value="in_process">in process</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Sample size</span>
            <input type="number" step="0.01" {...register("sample_size")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Product</span>
            <select {...register("product_id")} className={cls}>
              <option value="">— none —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Kit batch</span>
            <select {...register("batch_id")} className={cls}>
              <option value="">— none —</option>
              {batches.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Inspected by</span>
            <input {...register("inspected_by")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Remarks</span>
            <input {...register("remarks")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Readings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-ink-gray-5">A numeric reading is graded against its min/max on evaluation. Leave min/max blank for a pass-by-default check.</p>
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="col-span-2 block text-xs">
                  <span className="text-ink-gray-5">Parameter</span>
                  <input {...register(`readings.${i}.parameter`)} className={cls} placeholder="pH" />
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">Reading</span>
                  <input type="number" step="0.0001" {...register(`readings.${i}.reading_value`)} className={cls} />
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">Min</span>
                  <input type="number" step="0.0001" {...register(`readings.${i}.min_value`)} className={cls} />
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">Max</span>
                  <input type="number" step="0.0001" {...register(`readings.${i}.max_value`)} className={cls} />
                </label>
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ parameter: "", reading_value: "", min_value: "", max_value: "" })}>
            <PlusIcon size={14} className="mr-1" /> Add reading
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        Create inspection
      </Button>
    </form>
  );
}
