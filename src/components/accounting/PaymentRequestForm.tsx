"use client";

import { useForm } from "react-hook-form";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { savePaymentRequest, type PaymentRequestInput } from "@/app/actions/payment_request";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

interface InvoiceOpt { id: string; label: string; lab_id: string | null; outstanding: number; }
interface Opt { id: string; label: string; }

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

export function PaymentRequestForm({
  invoices,
  modes,
}: {
  invoices: InvoiceOpt[];
  modes: Opt[];
}) {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();

  const { register, handleSubmit, setValue, watch } = useForm<PaymentRequestInput>({
    defaultValues: {
      request_no: "",
      invoice_id: "",
      lab_id: "",
      amount: 0,
      mode_of_payment_id: "",
      posting_date: new Date().toISOString().slice(0, 10),
      message: "",
    },
  });
  const invoiceId = watch("invoice_id");
  const selected = invoices.find((i) => i.id === invoiceId);

  function onInvoice(id: string) {
    setValue("invoice_id", id);
    const inv = invoices.find((x) => x.id === id);
    if (inv) {
      setValue("lab_id", inv.lab_id ?? "");
      setValue("amount", inv.outstanding);
    }
  }

  function onSubmit(values: PaymentRequestInput) {
    start(async () => {
      const res = await savePaymentRequest({ ...values, lab_id: values.lab_id || null });
      if (res.ok) router.push("/payment-requests");
    });
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <Card>
        <CardHeader><CardTitle>{t(locale, "Payment Request")}</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-sm">
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Request no.")}</span>
            <input {...register("request_no")} className={cls} placeholder="auto if blank" />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Posting date")}</span>
            <input type="date" {...register("posting_date")} className={cls} />
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">{t(locale, "Sales invoice")}</span>
            <select value={invoiceId} onChange={(e) => onInvoice(e.target.value)} className={cls}>
              <option value="">{t(locale, "Select an unpaid invoice…")}</option>
              {invoices.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
            </select>
            {selected ? (
              <span className="mt-1 block text-xs text-ink-gray-5">Outstanding: {selected.outstanding.toLocaleString()}</span>
            ) : null}
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Amount")}</span>
            <input type="number" step="0.01" {...register("amount")} className={cls} />
          </label>
          <label className="block">
            <span className="font-medium text-ink-gray-8">{t(locale, "Mode of payment")}</span>
            <select {...register("mode_of_payment_id")} className={cls}>
              <option value="">{t(locale, "— none —")}</option>
              {modes.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="font-medium text-ink-gray-8">{t(locale, "Message")}</span>
            <input {...register("message")} className={cls} placeholder="Please settle this invoice…" />
          </label>
        </CardContent>
      </Card>

      <Button type="submit" variant="solid" size="md" disabled={pending}>
        {pending ? <Loader2Icon size={14} className="mr-1 animate-spin" /> : null}
        {t(locale, "Create request (draft)")}
      </Button>
    </form>
  );
}
