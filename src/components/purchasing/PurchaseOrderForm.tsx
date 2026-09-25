"use client";

import { RecentOptions, noteRecent } from "@/components/form/RecentOptions";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { savePurchaseOrder, updatePurchaseOrder, type PurchaseOrderInput } from "@/app/actions/purchase_order";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";

interface Opt { id: string; label: string; }
interface ProductOpt extends Opt { buy: number; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function PurchaseOrderForm({
  suppliers,
  products,
  orderId,
  defaults,
}: {
  suppliers: Opt[];
  products: ProductOpt[];
  /** When set, edits this existing draft PO instead of creating one. */
  orderId?: string;
  defaults?: PurchaseOrderInput;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  // A refusal from the server (a missing customer, a closed period…) is said, not swallowed.
  const [error, setError] = useState<string | null>(null);

  const { register, control, handleSubmit, setValue } = useForm<PurchaseOrderInput>({
    defaultValues: defaults ?? {
      po_no: "",
      supplier_id: "",
      transaction_date: localDate(),
      required_by: "",
      notes: "",
      items: [{ product_id: "", qty: 1, rate: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const total = (items ?? []).reduce((s, l) => s + (Number(l?.qty) || 0) * (Number(l?.rate) || 0), 0);

  function onProduct(index: number, productId: string) {
    setValue(`items.${index}.product_id`, productId);
    const p = products.find((x) => x.id === productId);
    if (p) setValue(`items.${index}.rate`, p.buy);
  }

  function onSubmit(values: PurchaseOrderInput) {
    const payload = { ...values, supplier_id: values.supplier_id || null };
    start(async () => {
      const res = orderId ? await updatePurchaseOrder(orderId, payload) : await savePurchaseOrder(payload);
      if (res.ok) router.push(orderId ? `/purchase-orders/${orderId}` : "/purchase-orders");
      else setError(res.error ?? "Could not save");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Purchase Order")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "PO no.")}</span>
            <input {...register("po_no")} className={cls} placeholder="PO-0001" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Supplier")}</span>
            <select {...register("supplier_id", { onChange: (e) => noteRecent("supplier", e.target.value) })} className={cls}>
              <option value="">{t(locale, "— none —")}</option>
              <RecentOptions kind="supplier" options={suppliers} />
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Order date")}</span>
            <input type="date" lang="en-CA" {...register("transaction_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Required by")}</span>
            <input type="date" lang="en-CA" {...register("required_by")} className={cls} />
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
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="col-span-3 block text-xs">
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
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button type="button" variant="subtle" size="sm" onClick={() => append({ product_id: "", qty: 1, rate: 0 })}>
              <PlusIcon size={14} className="mr-1" /> {t(locale, "Add item")}
            </Button>
            <div className="text-sm font-semibold">{t(locale, "Total:")} {total.toLocaleString("en-US")}</div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, orderId ? "Save changes" : "Create order (draft)")}
      </Button>
    {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{t(locale, error)}</p>
      ) : null}
    </form>
  );
}
