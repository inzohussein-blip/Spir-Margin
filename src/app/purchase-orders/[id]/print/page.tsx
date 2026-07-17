import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentSheet, type DocLine } from "@/components/print/DocumentSheet";

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

  const lines: DocLine[] = (po.purchase_order_items ?? []).map((it) => ({
    label: it.products?.name ?? "Item",
    sub: it.products?.item_code ?? null,
    qty: Number(it.qty),
    rate: Number(it.rate),
    amount: Number(it.amount),
  }));

  return (
    <DocumentSheet
      docType="Purchase Order"
      docNo={po.po_no}
      date={po.transaction_date}
      backHref={`/purchase-orders/${po.id}`}
      parties={[
        { heading: "Supplier", name: po.companies?.name ?? "—" },
        { heading: "Ordered by", name: "Spir-Margin", lines: ["Medical devices & lab supplies"] },
      ]}
      meta={[
        { label: "Order date", value: po.transaction_date },
        { label: "Required by", value: po.required_by ?? "—" },
        { label: "Status", value: <span className="capitalize">{po.status.replace(/_/g, " ")}</span> },
      ]}
      lines={lines}
      totals={[{ label: "Total", value: Number(po.total_amount), strong: true }]}
      notes={po.notes}
      footer="Please confirm receipt of this purchase order — Spir-Margin"
    />
  );
}
