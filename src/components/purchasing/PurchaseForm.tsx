"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { savePurchase, type PurchaseInput } from "@/app/actions/purchasing";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }
interface ProductOpt extends Opt { type: string; buy: number; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function PurchaseForm({
  suppliers,
  products,
  warehouses,
  terms,
}: {
  suppliers: Opt[];
  products: ProductOpt[];
  warehouses: Opt[];
  terms: Opt[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit, setValue } = useForm<PurchaseInput>({
    defaultValues: {
      supplier_id: "",
      posting_date: new Date().toISOString().slice(0, 10),
      reference_no: "",
      payment_term_id: "",
      notes: "",
      items: [{ product_id: "", qty: 1, rate: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const total = (items ?? []).reduce((s, l) => s + (Number(l?.qty) || 0) * (Number(l?.rate) || 0), 0);

  function onSubmit(values: PurchaseInput) {
    start(async () => {
      const res = await savePurchase({ ...values, supplier_id: values.supplier_id || null });
      if (res.ok) router.push("/purchases");
    });
  }

  // prefill rate from the product's default buy price
  function onProduct(index: number, productId: string) {
    setValue(`items.${index}.product_id`, productId);
    const p = products.find((x) => x.id === productId);
    if (p) setValue(`items.${index}.rate`, p.buy);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Purchase")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Supplier")}</span>
            <select {...register("supplier_id")} className={cls}>
              <option value="">{t(locale, "— none —")}</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Payment term")}</span>
            <select {...register("payment_term_id")} className={cls}>
              <option value="">{t(locale, "— none —")}</option>
              {terms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Posting date")}</span>
            <input type="date" {...register("posting_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Supplier invoice no.")}</span>
            <input {...register("reference_no")} className={cls} />
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
          {fields.map((f, i) => {
            const prod = products.find((p) => p.id === items?.[i]?.product_id);
            const isKit = prod?.type === "kit";
            return (
              <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <label className="col-span-2 block text-xs">
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
                    <input type="number" step="0.01" {...register(`items.${i}.rate`)} className={cls} />
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
                {isKit && (
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <label className="block text-xs">
                      <span className="text-ink-gray-5">{t(locale, "Batch no. (kit)")}</span>
                      <input {...register(`items.${i}.batch_no`)} className={cls} placeholder="auto if empty" />
                    </label>
                    <label className="block text-xs">
                      <span className="text-ink-gray-5">{t(locale, "Expiry date (kit)")}</span>
                      <input type="date" {...register(`items.${i}.expiry_date`)} className={cls} />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between">
            <Button type="button" variant="subtle" size="sm" onClick={() => append({ product_id: "", qty: 1, rate: 0 })}>
              <PlusIcon size={14} className="mr-1" /> {t(locale, "Add item")}
            </Button>
            <div className="text-sm font-semibold">{t(locale, "Total:")} {total.toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Create purchase (draft)")}
      </Button>
    </form>
  );
}
