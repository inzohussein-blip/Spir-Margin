"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveRfq, type RfqInput } from "@/app/actions/rfq";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function RfqForm({ products, suppliers }: { products: Opt[]; suppliers: Opt[] }) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<Record<string, boolean>>({});

  const { register, control, handleSubmit } = useForm<RfqInput>({
    defaultValues: {
      rfq_no: "",
      transaction_date: new Date().toISOString().slice(0, 10),
      schedule_date: "",
      message: "",
      items: [{ product_id: "", qty: 1 }],
      supplier_ids: [],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  function onSubmit(values: RfqInput) {
    const supplier_ids = Object.entries(picked).filter(([, v]) => v).map(([k]) => k);
    start(async () => {
      const res = await saveRfq({ ...values, supplier_ids });
      if (res.ok) router.push("/rfqs");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Request for Quotation")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "RFQ no.")}</span>
            <input {...register("rfq_no")} className={cls} placeholder="RFQ-0001" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Date")}</span>
            <input type="date" {...register("transaction_date")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Reply by")}</span>
            <input type="date" {...register("schedule_date")} className={cls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">{t(locale, "Message to suppliers")}</span>
            <input {...register("message")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Items")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="col-span-4 block text-xs">
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
                <div className="flex items-end justify-end">
                  <Button type="button" variant="subtle" size="sm" onClick={() => remove(i)} disabled={fields.length === 1}>
                    <Trash2Icon size={14} />
                  </Button>
                </div>
              </div>
            </div>
          ))}
          <Button type="button" variant="subtle" size="sm" onClick={() => append({ product_id: "", qty: 1 })}>
            <PlusIcon size={14} className="mr-1" /> {t(locale, "Add item")}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Suppliers to ask")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {suppliers.map((s) => (
            <label key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!picked[s.id]}
                onChange={(e) => setPicked((p) => ({ ...p, [s.id]: e.target.checked }))}
                className="h-4 w-4 rounded border-outline-gray-2"
              />
              {s.label}
            </label>
          ))}
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        Create RFQ (draft)
      </Button>
    </form>
  );
}
