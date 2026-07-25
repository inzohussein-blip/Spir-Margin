import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentSheet, type DocLine } from "@/components/print/DocumentSheet";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

interface Item { qty: number; rate: number; amount: number; products: { name: string; item_code: string | null } | null; }
interface Quotation {
  id: string; naming_series: string | null; transaction_date: string; valid_till: string | null;
  status: string; total_amount: number; currency: string | null; notes: string | null;
  labs: { name: string; code: string | null } | null;
  quotation_items: Item[];
}

export default async function QuotationPrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("quotations")
    .select("id, naming_series, transaction_date, valid_till, status, total_amount, currency, notes, labs(name, code), quotation_items(qty, rate, amount, products(name, item_code))")
    .eq("id", params.id)
    .single();
  const q = data as unknown as Quotation | null;
  if (!q) notFound();

  const locale = getLocale();
  const currency = q.currency || "USD";
  const lines: DocLine[] = (q.quotation_items ?? []).map((it) => ({
    label: it.products?.name ?? "Item",
    sub: it.products?.item_code ?? null,
    qty: Number(it.qty),
    rate: Number(it.rate),
    amount: Number(it.amount),
  }));

  return (
    <DocumentSheet
      docType={t(locale, "Quotation")}
      docNo={q.naming_series || `QTN-${q.id.slice(0, 8)}`}
      date={q.transaction_date}
      backHref="/quotations"
      currency={currency}
      parties={[
        { heading: t(locale, "Prepared for"), name: q.labs?.name ?? "—", lines: [q.labs?.code ? `${t(locale, "Code:")} ${q.labs.code}` : null] },
        { heading: t(locale, "From"), name: "Spir-Margin", lines: [t(locale, "Medical devices & lab supplies")] },
      ]}
      meta={[
        { label: t(locale, "Date"), value: q.transaction_date },
        { label: t(locale, "Valid till"), value: q.valid_till ?? "—" },
        { label: t(locale, "Status"), value: <span>{statusLabel(locale, q.status)}</span> },
      ]}
      lines={lines}
      totals={[{ label: t(locale, "Total"), value: Number(q.total_amount), strong: true }]}
      notes={q.notes}
      footer={t(locale, "This quotation is valid until the date shown above — Spir-Margin")}
    />
  );
}
