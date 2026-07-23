import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProducts, getLabs } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { SalesOrderForm } from "@/components/selling/SalesOrderForm";
import type { SalesOrderInput } from "@/app/actions/selling";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

interface Item { product_id: string; qty: number; rate: number; serial_no: string | null; }
interface Order {
  id: string; lab_id: string; status: string; transaction_date: string;
  delivery_date: string | null; notes: string | null;
  sales_order_items: Item[];
}

export default async function EditSalesOrderPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_orders")
    .select("id, lab_id, status, transaction_date, delivery_date, notes, sales_order_items(product_id, qty, rate, serial_no)")
    .eq("id", params.id)
    .single();
  const so = data as unknown as Order | null;
  if (!so) notFound();
  // Only draft orders are editable — a delivered order has posted sales.
  if (so.status !== "draft") redirect(`/sales-orders/${so.id}`);

  const [products, labs] = await Promise.all([getProducts(), getLabs()]);
  const defaults: SalesOrderInput = {
    lab_id: so.lab_id,
    transaction_date: so.transaction_date,
    delivery_date: so.delivery_date ?? "",
    notes: so.notes ?? "",
    items: (so.sales_order_items ?? []).map((it) => ({
      product_id: it.product_id,
      qty: Number(it.qty),
      rate: Number(it.rate),
      serial_no: it.serial_no ?? "",
    })),
  };
  if (defaults.items.length === 0) defaults.items = [{ product_id: "", qty: 1, rate: 0, serial_no: "" }];

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href={`/sales-orders/${so.id}`} className="hover:text-brand">← {t(locale, "Sales order")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Edit sales order")}</h1>
      <SalesOrderForm
        orderId={so.id}
        defaults={defaults}
        labs={labs.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` }))}
        products={products.map((p) => ({ id: p.id, label: `${p.name} (${p.item_code})`, sell: Number(p.default_sell_price) }))}
      />
    </div>
  );
}
