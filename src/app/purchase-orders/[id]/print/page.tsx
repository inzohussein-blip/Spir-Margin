import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentSheet, type DocLine } from "@/components/print/DocumentSheet";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { statusLabel } from "@/lib/status";

export const dynamic = "force-dynamic";

interface Item { qty: number; rate: number; amount: number; products: { name: string; item_code: string | null } | null; }
interface PO {
  id: string; po_no: string; transaction_date: string; required_by: string | null;
  status: string; total_amount: number; notes: string | null;
  companies: { name: string } | null;
  purchase_order_items: Item[];
}

export default async function PurchaseOrderPrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, po_no, transaction_date, required_by, status, total_amount, notes, companies:supplier_id(name), purchase_order_items(qty, rate, amount, products(name, item_code))")
    .eq("id", params.id)
    .single();
  const po = data as unknown as PO | null;
  if (!po) notFound();

  const locale = getLocale();
  const lines: DocLine[] = (po.purchase_order_items ?? []).map((it) => ({
    label: it.products?.name ?? "Item",
    sub: it.products?.item_code ?? null,
    qty: Number(it.qty),
    rate: Number(it.rate),
    amount: Number(it.amount),
  }));

  return (
    <DocumentSheet
      docType={t(locale, "Purchase Order")}
      docNo={po.po_no}
      date={po.transaction_date}
      backHref={`/purchase-orders/${po.id}`}
      parties={[
        { heading: t(locale, "Supplier"), name: po.companies?.name ?? "—" },
        { heading: t(locale, "Ordered by"), name: "Spir-Margin", lines: [t(locale, "Medical devices & lab supplies")] },
      ]}
      meta={[
        { label: t(locale, "Order date"), value: po.transaction_date },
        { label: t(locale, "Required by"), value: po.required_by ?? "—" },
        { label: t(locale, "Status"), value: <span>{statusLabel(locale, po.status)}</span> },
      ]}
      lines={lines}
      totals={[{ label: t(locale, "Total"), value: Number(po.total_amount), strong: true }]}
      notes={po.notes}
      footer={t(locale, "Please confirm receipt of this purchase order — Spir-Margin")}
    />
  );
}
