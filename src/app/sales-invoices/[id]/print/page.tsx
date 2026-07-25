import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentSheet, type DocLine } from "@/components/print/DocumentSheet";
import { getUsdIqdRate } from "@/app/actions/currency";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

interface Item { qty: number; rate: number; amount: number; products: { name: string; item_code: string | null } | null; }
interface Invoice {
  id: string; invoice_no: string; posting_date: string; due_date: string | null;
  status: string; total_amount: number; paid_amount: number; outstanding: number;
  currency: string | null; notes: string | null;
  labs: { name: string; code: string | null } | null;
  sales_invoice_items: Item[];
}

export default async function InvoicePrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_invoices")
    .select("id, invoice_no, posting_date, due_date, status, total_amount, paid_amount, outstanding, currency, notes, labs(name, code), sales_invoice_items(qty, rate, amount, products(name, item_code))")
    .eq("id", params.id)
    .single();
  const inv = data as unknown as Invoice | null;
  if (!inv) notFound();

  const locale = getLocale();
  const currency = inv.currency || "USD";
  const rate = await getUsdIqdRate();
  const lines: DocLine[] = (inv.sales_invoice_items ?? []).map((it) => ({
    label: it.products?.name ?? "Item",
    sub: it.products?.item_code ?? null,
    qty: Number(it.qty),
    rate: Number(it.rate),
    amount: Number(it.amount),
  }));

  return (
    <DocumentSheet
      docType={t(locale, "Invoice")}
      docNo={inv.invoice_no}
      date={inv.posting_date}
      backHref={`/sales-invoices/${inv.id}`}
      currency={currency}
      parties={[
        { heading: t(locale, "Billed to"), name: inv.labs?.name ?? "—", lines: [inv.labs?.code ? `${t(locale, "Code:")} ${inv.labs.code}` : null] },
        { heading: t(locale, "From"), name: "Spir-Margin", lines: [t(locale, "Medical devices & lab supplies")] },
      ]}
      meta={[
        { label: t(locale, "Invoice date"), value: inv.posting_date },
        { label: t(locale, "Due date"), value: inv.due_date ?? "—" },
        { label: t(locale, "Status"), value: <span>{statusLabel(locale, inv.status)}</span> },
      ]}
      lines={lines}
      totals={[
        { label: t(locale, "Total"), value: Number(inv.total_amount) },
        { label: t(locale, "Paid"), value: Number(inv.paid_amount) },
        { label: t(locale, "Balance due"), value: Number(inv.outstanding), strong: true },
      ]}
      notes={inv.notes}
      footer={rate > 0
        ? `Balance due ≈ ${new Intl.NumberFormat("en-US").format(Math.round(Number(inv.outstanding) * rate))} IQD (1 USD = ${new Intl.NumberFormat("en-US").format(rate)} IQD) — Spir-Margin`
        : undefined}
    />
  );
}
