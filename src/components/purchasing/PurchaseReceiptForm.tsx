"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { savePurchaseReceipt, type PurchaseReceiptInput } from "@/app/actions/purchase_receipt";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Opt { id: string; label: string; }
interface ProductOpt extends Opt { buy: number; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function PurchaseReceiptForm({
  suppliers,
  products,
  warehouses,
}: {
  suppliers: Opt[];
  products: ProductOpt[];
  warehouses: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit, setValue } = useForm<PurchaseReceiptInput>({
    defaultValues: {
      receipt_no: "",
      supplier_id: "",
      posting_date: new Date().toISOString().slice(0, 10),
      notes: "",
      items: [{ product_id: "", qty: 1, rate: 0, warehouse_id: "", batch_no: "", expiry_date: "" }],
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

  function onSubmit(values: PurchaseReceiptInput) {
    start(async () => {
      const res = await savePurchaseReceipt({ ...values, supplier_id: values.supplier_id || null });
      if (res.ok) router.push("/purchase-receipts");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Purchase Receipt</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">Receipt no.</span>
            <input {...register("receipt_no")} className={cls} placeholder="PR-0001" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Supplier</span>
            <select {...register("supplier_id")} className={cls}>
              <option value="">— none —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">Posting date</span>
            <input type="date" {...register("posting_date")} className={cls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">Notes</span>
            <input {...register("notes")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Items received</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="col-span-2 block text-xs">
                  <span className="text-ink-gray-5">Product</span>
                  <select value={items?.[i]?.product_id ?? ""} onChange={(e) => onProduct(i, e.target.value)} className={cls}>
                    <option value="">Select…</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
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
                <label className="block text-xs">
                  <span className="text-ink-gray-5">Warehouse</span>
                  <select {...register(`items.${i}.warehouse_id`)} className={cls}>
                    <option value="">—</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.label}</option>)}
                  </select>
                </label>
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
                <label className="block text-xs sm:col-span-3">
                  <span className="text-ink-gray-5">Batch no. (optional)</span>
                  <input {...register(`items.${i}.batch_no`)} className={cls} placeholder="auto if blank" />
                </label>
                <label className="block text-xs sm:col-span-3">
                  <span className="text-ink-gray-5">Expiry date (optional)</span>
                  <input type="date" {...register(`items.${i}.expiry_date`)} className={cls} />
                </label>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between">
            <Button type="button" variant="subtle" size="sm" onClick={() => append({ product_id: "", qty: 1, rate: 0, warehouse_id: "", batch_no: "", expiry_date: "" })}>
              <PlusIcon size={14} className="mr-1" /> Add item
            </Button>
            <div className="text-sm font-semibold">Total: {total.toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        Create receipt (draft)
      </Button>
    </form>
  );
}
