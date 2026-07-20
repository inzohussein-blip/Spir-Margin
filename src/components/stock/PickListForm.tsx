"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { savePickList, type PickListInput } from "@/app/actions/pick_list";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function PickListForm({
  labs,
  salesOrders,
  products,
  warehouses,
}: {
  labs: Opt[];
  salesOrders: Opt[];
  products: Opt[];
  warehouses: Opt[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit } = useForm<PickListInput>({
    defaultValues: {
      pick_no: "",
      lab_id: "",
      sales_order_id: "",
      purpose: "delivery",
      posting_date: new Date().toISOString().slice(0, 10),
      notes: "",
      items: [{ product_id: "", warehouse_id: "", qty: 1, batch_no: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const totalQty = (items ?? []).reduce((s, l) => s + (Number(l?.qty) || 0), 0);

  function onSubmit(values: PickListInput) {
    start(async () => {
      const res = await savePickList({
        ...values,
        lab_id: values.lab_id || null,
        sales_order_id: values.sales_order_id || null,
      });
      if (res.ok) router.push("/pick-lists");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Pick List")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Pick no.")}</span>
            <input {...register("pick_no")} className={cls} placeholder={t(locale, "auto if blank")} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Purpose")}</span>
            <select {...register("purpose")} className={cls}>
              <option value="delivery">Delivery</option>
              <option value="material_transfer">Material transfer</option>
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Lab")}</span>
            <select {...register("lab_id")} className={cls}>
              <option value="">{t(locale, "— none —")}</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Sales order")}</span>
            <select {...register("sales_order_id")} className={cls}>
              <option value="">{t(locale, "— none —")}</option>
              {salesOrders.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
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
        <CardHeader><CardTitle>{t(locale, "Items to pick")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="col-span-2 block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Product")}</span>
                  <select {...register(`items.${i}.product_id`)} className={cls}>
                    <option value="">{t(locale, "Select…")}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Warehouse")}</span>
                  <select {...register(`items.${i}.warehouse_id`)} className={cls}>
                    <option value="">{t(locale, "—")}</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Qty")}</span>
                  <input type="number" step="0.01" {...register(`items.${i}.qty`)} className={cls} />
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Batch no.")}</span>
                  <input {...register(`items.${i}.batch_no`)} className={cls} placeholder={t(locale, "optional")} />
                </label>
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button type="button" variant="subtle" size="sm" onClick={() => append({ product_id: "", warehouse_id: "", qty: 1, batch_no: "" })}>
              <PlusIcon size={14} className="mr-1" /> {t(locale, "Add item")}
            </Button>
            <div className="text-sm font-semibold">{t(locale, "Total qty:")} {totalQty.toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Create pick list (draft)")}
      </Button>
    </form>
  );
}
