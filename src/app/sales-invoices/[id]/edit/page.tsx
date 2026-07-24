import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLabs, getProducts } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { SalesInvoiceForm } from "@/components/selling/SalesInvoiceForm";
import type { SalesInvoiceInput } from "@/app/actions/sales_invoice";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

interface Item { product_id: string; qty: number; rate: number; }
interface Invoice {
  id: string; invoice_no: string; lab_id: string; status: string;
  posting_date: string; due_date: string | null; currency: string; notes: string | null;
  sales_invoice_items: Item[];
}

export default async function EditSalesInvoicePage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_invoices")
    .select("id, invoice_no, lab_id, status, posting_date, due_date, currency, notes, sales_invoice_items(product_id, qty, rate)")
    .eq("id", params.id)
    .single();
  const inv = data as unknown as Invoice | null;
  if (!inv) notFound();
  // Only draft invoices are editable — a submitted one may carry payments.
  if (inv.status !== "draft") redirect(`/sales-invoices/${inv.id}`);

  const [labs, products] = await Promise.all([getLabs(), getProducts()]);
  const defaults: SalesInvoiceInput = {
    invoice_no: inv.invoice_no ?? "",
    lab_id: inv.lab_id,
    posting_date: inv.posting_date,
    due_date: inv.due_date ?? "",
    currency: inv.currency ?? "USD",
    notes: inv.notes ?? "",
    items: (inv.sales_invoice_items ?? []).map((it) => ({
      product_id: it.product_id,
      qty: Number(it.qty),
      rate: Number(it.rate),
    })),
  };
  if (defaults.items.length === 0) defaults.items = [{ product_id: "", qty: 1, rate: 0 }];

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/sales-invoices" className="hover:text-brand">← {t(locale, "Sales invoices")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Edit invoice")}</h1>
      <SalesInvoiceForm
        invoiceId={inv.id}
        defaults={defaults}
        labs={labs.map((l) => ({ id: l.id as string, label: l.name as string }))}
        products={products.map((p) => ({
          id: p.id as string,
          label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
          sell: Number(p.default_sell_price ?? 0),
        }))}
      />
    </div>
  );
}
