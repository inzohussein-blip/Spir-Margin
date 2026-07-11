"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveTaxTemplate, type TaxTemplateInput } from "@/app/actions/tax";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function TaxTemplateForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { register, control, handleSubmit } = useForm<TaxTemplateInput>({
    defaultValues: { title: "", applies_to: "selling", tax_category: "", rows: [{ description: "VAT", rate: 0 }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "rows" });

  function onSubmit(values: TaxTemplateInput) {
    start(async () => {
      const res = await saveTaxTemplate(values);
      if (res.ok) router.push("/taxes");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Tax template</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-sm">
          <label className="block sm:col-span-1">
            <span className="font-medium text-ink-gray-8">Title *</span>
            <input {...register("title", { required: true })} className={cls} placeholder="VAT 15%" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Applies to</span>
            <select {...register("applies_to")} className={cls}>
              <option value="selling">selling</option>
              <option value="buying">buying</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Tax category</span>
            <input {...register("tax_category")} className={cls} placeholder="Standard" />
          </label>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Tax rows</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <label className="col-span-2 block text-xs sm:col-span-4">
                <span className="text-ink-gray-5">Description</span>
                <input {...register(`rows.${i}.description`)} className={cls} placeholder="VAT" />
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">Rate %</span>
                <input type="number" step="0.001" {...register(`rows.${i}.rate`)} className={cls} />
              </label>
              <div className="flex items-end justify-end">
                <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                  <Trash2Icon size={14} />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ description: "", rate: 0 })}>
            <PlusIcon size={14} className="mr-1" /> Add row
          </Button>
        </CardContent>
      </Card>
      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        Create template
      </Button>
    </form>
  );
}
