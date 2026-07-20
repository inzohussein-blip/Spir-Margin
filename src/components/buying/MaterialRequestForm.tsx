"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveMaterialRequest, type MaterialRequestInput } from "@/app/actions/material";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function MaterialRequestForm({ products, warehouses }: { products: Opt[]; warehouses: Opt[] }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const { register, control, handleSubmit } = useForm<MaterialRequestInput>({
    defaultValues: {
      transaction_date: new Date().toISOString().slice(0, 10),
      required_by: "",
      notes: "",
      items: [{ product_id: "", qty: 1 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  function onSubmit(values: MaterialRequestInput) {
    start(async () => {
      const res = await saveMaterialRequest(values);
      if (res.ok) router.push("/material-requests");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Request")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Date")}</span>
            <input type="date" {...register("transaction_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Required by")}</span>
            <input type="date" {...register("required_by")} className={cls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">{t(locale, "Notes")}</span>
            <input {...register("notes")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Items")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
              <label className="col-span-2 block text-xs sm:col-span-3">
                <span className="text-ink-gray-5">{t(locale, "Product")}</span>
                <select {...register(`items.${i}.product_id`)} className={cls}>
                  <option value="">{t(locale, "Select…")}</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Qty")}</span>
                <input type="number" step="0.01" {...register(`items.${i}.qty`)} className={cls} />
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Warehouse")}</span>
                <select {...register(`items.${i}.warehouse_id`)} className={cls}>
                  <option value="">{t(locale, "—")}</option>
                  {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                </select>
              </label>
              <div className="flex items-end justify-end">
                <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                  <Trash2Icon size={14} />
                </Button>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ product_id: "", qty: 1 })}>
            <PlusIcon size={14} className="mr-1" /> {t(locale, "Add item")}
          </Button>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Create request (draft)")}
      </Button>
    </form>
  );
}
