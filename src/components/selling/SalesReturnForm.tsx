"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveSalesReturn, type SalesReturnInput } from "@/app/actions/sales_return";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }
interface ProductOpt extends Opt { sell: number; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function SalesReturnForm({ labs, products }: { labs: Opt[]; products: ProductOpt[] }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const { register, control, handleSubmit, setValue } = useForm<SalesReturnInput>({
    defaultValues: {
      lab_id: "",
      posting_date: new Date().toISOString().slice(0, 10),
      reason: "",
      notes: "",
      items: [{ product_id: "", qty: 1, sell_price: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const total = (items ?? []).reduce((s, l) => s + (Number(l?.qty) || 0) * (Number(l?.sell_price) || 0), 0);

  function onProduct(index: number, productId: string) {
    setValue(`items.${index}.product_id`, productId);
    const p = products.find((x) => x.id === productId);
    if (p) setValue(`items.${index}.sell_price`, p.sell);
  }

  function onSubmit(values: SalesReturnInput) {
    setError(null);
    start(async () => {
      const res = await saveSalesReturn(values);
      if (res.ok) router.push("/sales-returns");
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      <Card>
        <CardHeader><CardTitle>{t(locale, "Sales Return")}</CardTitle></CardHeader>
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
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Reason")}</span>
            <input {...register("reason")} className={cls} placeholder={t(locale, "e.g. damaged, wrong item")} />
          </label>
          <label className="block">
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
                <select value={items?.[i]?.product_id ?? ""} onChange={(e) => onProduct(i, e.target.value)} className={cls}>
                  <option value="">{t(locale, "Select…")}</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Qty")}</span>
                <input type="number" step="0.01" {...register(`items.${i}.qty`)} className={cls} />
              </label>
              <label className="block text-xs">
                <span className="text-ink-gray-5">{t(locale, "Rate")}</span>
                <input type="number" step="0.01" {...register(`items.${i}.sell_price`)} className={cls} />
              </label>
              <div className="flex items-end justify-end">
                <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                  <Trash2Icon size={14} />
                </Button>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button type="button" variant="subtle" size="sm" onClick={() => append({ product_id: "", qty: 1, sell_price: 0 })}>
              <PlusIcon size={14} className="mr-1" /> {t(locale, "Add item")}
            </Button>
            <div className="text-sm font-semibold">{t(locale, "Total:")} {total.toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Book return")}
      </Button>
    </form>
  );
}
