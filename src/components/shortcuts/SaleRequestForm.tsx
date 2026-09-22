"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon, Loader2Icon, AlertCircleIcon } from "lucide-react";
import { saveSaleRequest, updateSaleRequest, type SaleRequestInput } from "@/app/actions/sale_request";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useLocale } from "@/components/LocaleProvider";
import { fmtNum } from "@/lib/format";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }
interface ProductOpt extends Opt { sell: number; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

/**
 * A sales request.
 *
 * Looser than a sales order on purpose: a line may pick a product from the
 * catalogue or simply describe one, because this is often written while the
 * customer is still on the phone. Picking a product fills the description and
 * the price, and both stay editable.
 */
export function SaleRequestForm({
  labs,
  products,
  requestId,
  defaults,
}: {
  labs: Opt[];
  products: ProductOpt[];
  requestId?: string;
  defaults?: SaleRequestInput;
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const editing = Boolean(requestId);
  const { register, control, handleSubmit, setValue } = useForm<SaleRequestInput>({
    defaultValues: defaults ?? {
      lab_id: "",
      customer_name: "",
      customer_phone: "",
      request_date: new Date().toISOString().slice(0, 10),
      currency: "USD",
      discount: 0,
      notes: "",
      items: [{ product_id: "", description: "", qty: 1, rate: 0 }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const items = useWatch({ control, name: "items" }) ?? [];
  const discount = Number(useWatch({ control, name: "discount" }) ?? 0) || 0;
  const subtotal = items.reduce(
    (s, l) => s + (Number(l?.qty) || 0) * (Number(l?.rate) || 0),
    0,
  );
  const total = Math.max(subtotal - discount, 0);

  const onPickProduct = (index: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setValue(`items.${index}.description`, p.label);
    setValue(`items.${index}.rate`, p.sell);
  };

  const onSubmit = handleSubmit((values) => {
    setError(null);
    start(async () => {
      const res = requestId
        ? await updateSaleRequest(requestId, values)
        : await saveSaleRequest(values);
      if (res && "error" in res && res.error) setError(t(locale, res.error));
      else router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircleIcon size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <Card>
        <CardHeader><CardTitle>{t(locale, "Who is this for")}</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Lab")}</span>
              <select {...register("lab_id")} className={cls}>
                <option value="">{t(locale, "— none —")}</option>
                {labs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
              <span className="mt-1 block text-xs text-ink-gray-5">
                {t(locale, "Or leave this empty and write the customer's name below.")}
              </span>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Date")}</span>
              <input type="date" lang="en-CA" {...register("request_date")} className={cls} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Customer name")}</span>
              <input {...register("customer_name")} className={cls} />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Phone")}</span>
              <input {...register("customer_phone")} className={cls} dir="ltr" />
            </label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t(locale, "What they are asking for")}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {fields.map((f, i) => (
              <div key={f.id} className="grid gap-2 rounded-lg border border-outline-gray-2 p-3 sm:grid-cols-[1fr_1fr_5rem_7rem_2.5rem] sm:items-end">
                <label className="block">
                  <span className="text-xs text-ink-gray-5">{t(locale, "Product")}</span>
                  <select
                    {...register(`items.${i}.product_id`)}
                    className={cls}
                    onChange={(e) => {
                      register(`items.${i}.product_id`).onChange(e);
                      onPickProduct(i, e.target.value);
                    }}
                  >
                    <option value="">{t(locale, "— free text —")}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-ink-gray-5">{t(locale, "Description")}</span>
                  <input {...register(`items.${i}.description`)} className={cls} />
                </label>
                <label className="block">
                  <span className="text-xs text-ink-gray-5">{t(locale, "Qty")}</span>
                  <input type="number" step="any" min="0" {...register(`items.${i}.qty`, { valueAsNumber: true })} className={cls} />
                </label>
                <label className="block">
                  <span className="text-xs text-ink-gray-5">{t(locale, "Rate")}</span>
                  <input type="number" step="any" min="0" {...register(`items.${i}.rate`, { valueAsNumber: true })} className={cls} />
                </label>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={fields.length === 1}
                  title={t(locale, "Remove this line")}
                  className="mb-1 grid size-9 place-items-center rounded-md border border-outline-gray-2 text-ink-gray-5 hover:border-red-300 hover:text-red-600 disabled:opacity-40"
                >
                  <Trash2Icon size={15} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => append({ product_id: "", description: "", qty: 1, rate: 0 })}
              className="inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand"
            >
              <PlusIcon size={15} /> {t(locale, "Add a line")}
            </button>
          </div>

          <div className="mt-5 grid gap-4 border-t border-outline-gray-2 pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="block sm:max-w-xs">
              <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Discount")}</span>
              <input type="number" step="any" min="0" {...register("discount", { valueAsNumber: true })} className={cls} />
            </label>
            <dl className="space-y-1 text-sm sm:text-end">
              <div className="flex justify-between gap-6 sm:justify-end">
                <dt className="text-ink-gray-5">{t(locale, "Subtotal")}</dt>
                <dd className="tabular-nums">{fmtNum(subtotal, { maximumFractionDigits: 2 })}</dd>
              </div>
              <div className="flex justify-between gap-6 sm:justify-end">
                <dt className="text-ink-gray-5">{t(locale, "Discount")}</dt>
                <dd className="tabular-nums">{fmtNum(discount, { maximumFractionDigits: 2 })}</dd>
              </div>
              <div className="flex justify-between gap-6 border-t border-outline-gray-2 pt-1 sm:justify-end">
                <dt className="font-semibold">{t(locale, "Total")}</dt>
                <dd className="text-lg font-bold tabular-nums">{fmtNum(total, { maximumFractionDigits: 2 })}</dd>
              </div>
            </dl>
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-medium text-ink-gray-7">{t(locale, "Notes")}</span>
            <textarea {...register("notes")} rows={2} className={cls} />
          </label>
        </CardContent>
      </Card>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-brand-dark active:scale-95 disabled:opacity-60"
      >
        {pending ? <Loader2Icon size={15} className="animate-spin" /> : null}
        {t(locale, editing ? "Save the changes" : "Save the request")}
      </button>
    </form>
  );
}
