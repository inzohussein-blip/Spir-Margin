"use client";

import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon, Trash2Icon, Loader2Icon, MinusIcon, FlaskConicalIcon,
  CalendarDaysIcon, ScanBarcodeIcon, PackageIcon, StickyNoteIcon, ShoppingCartIcon,
} from "lucide-react";
import { updateSalesOrder, type SalesOrderInput } from "@/app/actions/selling";
import { useLocale } from "@/components/LocaleProvider";
import { useOffline } from "@/components/offline/OfflineProvider";
import { CloudOffIcon } from "lucide-react";
import { t } from "@/lib/i18n";

interface Opt { id: string; label: string; }
interface ProductOpt extends Opt { sell: number; }

/** Soft, animated input — rounded, subtle shadow, brand focus glow. */
const field =
  "w-full rounded-xl border border-outline-gray-2 bg-surface-white px-3 py-2.5 text-sm text-ink-gray-8 " +
  "shadow-sm transition-all duration-200 placeholder:text-ink-gray-4 " +
  "focus:border-brand focus:shadow-md focus:ring-4 focus:ring-brand/15 focus:outline-none " +
  "hover:border-outline-gray-3";

const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export function SalesOrderForm({
  labs, products, orderId, defaults,
}: {
  labs: Opt[];
  products: ProductOpt[];
  /** When set, the form edits this existing draft order instead of creating one. */
  orderId?: string;
  defaults?: SalesOrderInput;
}) {
  const locale = useLocale();
  const router = useRouter();
  const { online, submitSalesOrder } = useOffline();
  const [pending, start] = useTransition();
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, control, handleSubmit, setValue, reset } = useForm<SalesOrderInput>({
    defaultValues: defaults ?? {
      lab_id: "",
      transaction_date: new Date().toISOString().slice(0, 10),
      delivery_date: "",
      notes: "",
      items: [{ product_id: "", qty: 1, rate: 0, serial_no: "" }],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const items = useWatch({ control, name: "items" });
  const total = (items ?? []).reduce((s, l) => s + (Number(l?.qty) || 0) * (Number(l?.rate) || 0), 0);
  const lineTotal = (i: number) => (Number(items?.[i]?.qty) || 0) * (Number(items?.[i]?.rate) || 0);

  function onProduct(index: number, productId: string) {
    setValue(`items.${index}.product_id`, productId);
    const p = products.find((x) => x.id === productId);
    if (p) setValue(`items.${index}.rate`, p.sell);
  }
  function bump(index: number, delta: number) {
    const cur = Number(items?.[index]?.qty) || 0;
    setValue(`items.${index}.qty`, Math.max(1, cur + delta));
  }
  function onSubmit(values: SalesOrderInput) {
    setError(null);
    setQueued(false);
    start(async () => {
      // Editing is online-only; creating goes through the offline outbox so a
      // new order can be captured with no connection and synced on reconnect.
      if (orderId) {
        const res = await updateSalesOrder(orderId, values);
        if (res.ok) router.push(`/sales-orders/${orderId}`);
        else setError(res.error);
        return;
      }
      const labName = labs.find((l) => l.id === values.lab_id)?.label;
      const res = await submitSalesOrder({
        labId: values.lab_id,
        labName,
        transaction_date: values.transaction_date,
        delivery_date: values.delivery_date ?? null,
        notes: values.notes,
        lines: values.items,
      });
      if (res.status === "synced") router.push("/sales-orders");
      else if (res.status === "queued") {
        // Offline: keep working — confirm, reset for the next order (don't
        // navigate, the list needs the server).
        setQueued(true);
        reset();
      } else setError(res.error);
    });
  }

  const gridCols = "md:grid md:grid-cols-[minmax(0,2.2fr)_140px_120px_minmax(0,1.5fr)_110px_44px] md:items-center md:gap-3";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-5xl space-y-5">
      {/* ---- Order header ---- */}
      <section className="overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-outline-gray-1 bg-gradient-to-l from-brand-light to-transparent px-5 py-3.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand/10 text-brand"><ShoppingCartIcon size={17} /></span>
          <h2 className="text-sm font-bold text-ink-gray-8">{t(locale, "Order")}</h2>
        </header>
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-ink-gray-7">
              <FlaskConicalIcon size={14} className="text-brand" /> {t(locale, "Lab *")}
            </span>
            <select {...register("lab_id", { required: true })} className={`${field} font-medium`}>
              <option value="">{t(locale, "Select…")}</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink-gray-7">
              <CalendarDaysIcon size={14} className="text-ink-gray-4" /> {t(locale, "Order date")}
            </span>
            <input type="date" {...register("transaction_date")} className={field} />
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink-gray-7">
              <CalendarDaysIcon size={14} className="text-ink-gray-4" /> {t(locale, "Delivery date")}
            </span>
            <input type="date" {...register("delivery_date")} className={field} />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1 flex items-center gap-1.5 text-sm font-medium text-ink-gray-7">
              <StickyNoteIcon size={14} className="text-ink-gray-4" /> {t(locale, "Notes")}
            </span>
            <input {...register("notes")} className={field} />
          </label>
        </div>
      </section>

      {/* ---- Line items: table on desktop, cards on mobile ---- */}
      <section className="overflow-hidden rounded-2xl border border-outline-gray-2 bg-surface-white shadow-sm">
        <header className="flex items-center gap-2 border-b border-outline-gray-1 bg-gradient-to-l from-brand-light to-transparent px-5 py-3.5">
          <span className="grid size-8 place-items-center rounded-lg bg-brand/10 text-brand"><PackageIcon size={17} /></span>
          <h2 className="text-sm font-bold text-ink-gray-8">{t(locale, "Items")}</h2>
          <span className="ms-auto rounded-full bg-surface-gray-2 px-2 py-0.5 text-xs font-medium text-ink-gray-6">{fields.length}</span>
        </header>

        <div className="p-3 sm:p-4">
          {/* desktop column header */}
          <div className={`hidden px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-gray-4 ${gridCols}`}>
            <span>{t(locale, "Product")}</span>
            <span className="text-center">{t(locale, "Qty")}</span>
            <span>{t(locale, "Rate")}</span>
            <span>{t(locale, "Serial no")}</span>
            <span className="text-end">{t(locale, "Total")}</span>
            <span />
          </div>

          <div className="space-y-3 md:space-y-1.5">
            {fields.map((f, i) => (
              <div
                key={f.id}
                className={`rounded-xl border border-outline-gray-2 bg-surface-white p-3 shadow-sm transition-all duration-200 hover:border-outline-gray-3 hover:shadow-md
                  md:rounded-lg md:border-transparent md:bg-transparent md:p-2 md:shadow-none md:hover:bg-surface-gray-1/60 md:hover:shadow-none
                  animate-in fade-in slide-in-from-top-1 ${gridCols}`}
              >
                {/* product */}
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink-gray-5 md:hidden">{t(locale, "Product")}</span>
                  <select value={items?.[i]?.product_id ?? ""} onChange={(e) => onProduct(i, e.target.value)} className={field}>
                    <option value="">{t(locale, "Select…")}</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </label>

                {/* qty stepper */}
                <label className="mt-3 block md:mt-0">
                  <span className="mb-1 block text-xs font-medium text-ink-gray-5 md:hidden">{t(locale, "Qty")}</span>
                  <div className="flex items-center rounded-xl border border-outline-gray-2 bg-surface-white shadow-sm transition-all focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/15">
                    <button type="button" onClick={() => bump(i, -1)} className="grid size-9 place-items-center rounded-s-xl text-ink-gray-5 transition-colors hover:bg-surface-gray-2 active:scale-90"><MinusIcon size={15} /></button>
                    <input type="number" step="1" {...register(`items.${i}.qty`)} className="w-full min-w-0 border-x border-outline-gray-2 py-2 text-center text-sm font-semibold tabular-nums focus:outline-none" />
                    <button type="button" onClick={() => bump(i, 1)} className="grid size-9 place-items-center rounded-e-xl text-ink-gray-5 transition-colors hover:bg-surface-gray-2 active:scale-90"><PlusIcon size={15} /></button>
                  </div>
                </label>

                {/* rate */}
                <label className="mt-3 block md:mt-0">
                  <span className="mb-1 block text-xs font-medium text-ink-gray-5 md:hidden">{t(locale, "Rate")}</span>
                  <input type="number" step="0.01" {...register(`items.${i}.rate`)} className={`${field} tabular-nums`} />
                </label>

                {/* serial no with leading icon */}
                <label className="mt-3 block md:mt-0">
                  <span className="mb-1 block text-xs font-medium text-ink-gray-5 md:hidden">{t(locale, "Serial no")}</span>
                  <div className="relative">
                    <ScanBarcodeIcon size={15} className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-gray-4 start-3" />
                    <input {...register(`items.${i}.serial_no`)} placeholder={t(locale, "optional")} className={`${field} ps-9 tabular-nums`} />
                  </div>
                </label>

                {/* line total */}
                <div className="mt-3 flex items-center justify-between md:mt-0 md:block md:text-end">
                  <span className="text-xs font-medium text-ink-gray-5 md:hidden">{t(locale, "Total")}</span>
                  <span className="text-sm font-bold tabular-nums text-ink-gray-8">{money(lineTotal(i))}</span>
                </div>

                {/* remove */}
                <div className="mt-3 flex justify-end md:mt-0 md:justify-center">
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    disabled={fields.length === 1}
                    className="grid size-9 place-items-center rounded-lg text-ink-gray-4 transition-all hover:bg-red-50 hover:text-red-600 active:scale-90 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-ink-gray-4"
                  >
                    <Trash2Icon size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => append({ product_id: "", qty: 1, rate: 0, serial_no: "" })}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-outline-gray-3 px-3.5 py-2 text-sm font-medium text-ink-gray-6 transition-all hover:border-brand hover:bg-brand-light hover:text-brand active:scale-95"
          >
            <PlusIcon size={15} /> {t(locale, "Add item")}
          </button>
        </div>

        {/* total bar */}
        <div className="flex items-center justify-between border-t border-outline-gray-1 bg-surface-gray-1/50 px-5 py-3.5">
          <span className="text-sm font-medium text-ink-gray-6">{t(locale, "Total:")}</span>
          <span className="text-xl font-bold tabular-nums text-brand">{money(total)}</span>
        </div>
      </section>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {queued && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
          <CloudOffIcon size={16} /> {t(locale, "Saved offline — it will sync automatically when you’re back online.")}
        </p>
      )}
      {!online && !orderId && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          <CloudOffIcon size={14} /> {t(locale, "Offline — the order is saved on this device and uploads automatically when the connection returns.")}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:shadow-lg active:translate-y-0 disabled:opacity-60 ${
          !online && !orderId ? "bg-amber-600 hover:bg-amber-700" : "bg-brand hover:bg-brand-dark"
        }`}
      >
        {pending ? <Loader2Icon size={15} className="animate-spin" /> : !online && !orderId ? <CloudOffIcon size={15} /> : <ShoppingCartIcon size={15} />}
        {t(locale, orderId ? "Save changes" : !online ? "Save order offline" : "Create order (draft)")}
      </button>
    </form>
  );
}
