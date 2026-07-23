import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentSheet, type DocLine } from "@/components/print/DocumentSheet";
import { getUsdIqdRate } from "@/app/actions/currency";

export const dynamic = "force-dynamic";

interface Item {
  qty: number; rate: number; amount: number; serial_no: string | null;
  products: { name: string; item_code: string | null } | null;
}
interface Order {
  id: string; naming_series: string | null; transaction_date: string; delivery_date: string | null;
  status: string; total_amount: number; currency: string | null; notes: string | null;
  labs: { name: string; code: string | null } | null;
  sales_order_items: Item[];
}

export default async function SalesOrderPrintPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_orders")
    .select("id, naming_series, transaction_date, delivery_date, status, total_amount, currency, notes, labs(name, code), sales_order_items(qty, rate, amount, serial_no, products(name, item_code))")
    .eq("id", params.id)
    .single();
  const so = data as unknown as Order | null;
  if (!so) notFound();

  const currency = so.currency || "USD";
  const rate = await getUsdIqdRate();
  const docNo = so.naming_series || `SO-${so.id.slice(0, 8).toUpperCase()}`;
  const lines: DocLine[] = (so.sales_order_items ?? []).map((it) => ({
    label: it.products?.name ?? "Item",
    sub: [it.products?.item_code, it.serial_no ? `S/N: ${it.serial_no}` : null].filter(Boolean).join(" · ") || null,
    qty: Number(it.qty),
    rate: Number(it.rate),
    amount: Number(it.amount),
  }));

  return (
    <DocumentSheet
      docType="Sales Order"
      docNo={docNo}
      date={so.transaction_date}
      backHref={`/sales-orders/${so.id}`}
      currency={currency}
      parties={[
        { heading: "Ordered by", name: so.labs?.name ?? "—", lines: [so.labs?.code ? `Code: ${so.labs.code}` : null] },
        { heading: "From", name: "Spir-Margin", lines: ["Medical devices & lab supplies"] },
      ]}
      meta={[
        { label: "Order date", value: so.transaction_date },
        { label: "Delivery date", value: so.delivery_date ?? "—" },
        { label: "Status", value: <span className="capitalize">{so.status.replace(/_/g, " ")}</span> },
      ]}
      lines={lines}
      totals={[{ label: "Total", value: Number(so.total_amount), strong: true }]}
      notes={so.notes}
      footer={rate > 0
        ? `Total ≈ ${new Intl.NumberFormat("en-US").format(Math.round(Number(so.total_amount) * rate))} IQD (1 USD = ${new Intl.NumberFormat("en-US").format(rate)} IQD) — Spir-Margin`
        : undefined}
    />
  );
}
