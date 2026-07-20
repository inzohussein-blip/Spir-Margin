"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import { saveProductBundle, type ProductBundleInput } from "@/app/actions/product_bundle";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }
interface ProductOpt extends Opt { sell: number; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function ProductBundleForm({
  products,
}: {
  products: ProductOpt[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, control, handleSubmit, setValue } = useForm<ProductBundleInput>({
    defaultValues: {
      product_id: "",
      description: "",
      is_active: true,
      items: [{ component_id: "", qty: 1, rate: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const total = (items ?? []).reduce((s, l) => s + (Number(l?.qty) || 0) * (Number(l?.rate) || 0), 0);

  function onComponent(index: number, productId: string) {
    setValue(`items.${index}.component_id`, productId);
    const p = products.find((x) => x.id === productId);
    if (p) setValue(`items.${index}.rate`, p.sell);
  }

  function onSubmit(values: ProductBundleInput) {
    start(async () => {
      const res = await saveProductBundle(values);
      if (res.ok) router.push("/product-bundles");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Product Bundle")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Bundle product (kit)")}</span>
            <select {...register("product_id")} className={cls}>
              <option value="">{t(locale, "Select…")}</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2 pt-6">
            <input type="checkbox" {...register("is_active")} className="h-4 w-4 rounded border-outline-gray-2" />
            <span className="font-medium text-ink-gray-8">{t(locale, "Active")}</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">{t(locale, "Description")}</span>
            <input {...register("description")} className={cls} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "Components")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {fields.map((f, i) => (
            <div key={f.id} className="rounded-lg border border-outline-gray-1 p-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                <label className="col-span-3 block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Component")}</span>
                  <select value={items?.[i]?.component_id ?? ""} onChange={(e) => onComponent(i, e.target.value)} className={cls}>
                    <option value="">{t(locale, "Select…")}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
                <label className="block text-xs">
                  <span className="text-ink-gray-5">{t(locale, "Qty")}</span>
                  <input type="number" step="0.001" {...register(`items.${i}.qty`)} className={cls} />
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
            <Button type="button" variant="subtle" size="sm" onClick={() => append({ component_id: "", qty: 1, rate: 0 })}>
              <PlusIcon size={14} className="mr-1" /> Add component
            </Button>
            <div className="text-sm font-semibold">Bundle value: {total.toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        Create bundle
      </Button>
    </form>
  );
}
