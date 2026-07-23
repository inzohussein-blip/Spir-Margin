import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSuppliers, getProducts } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { PurchaseOrderForm } from "@/components/purchasing/PurchaseOrderForm";
import type { PurchaseOrderInput } from "@/app/actions/purchase_order";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

interface Item { product_id: string; qty: number; rate: number; }
interface Order {
  id: string; po_no: string | null; supplier_id: string | null; status: string;
  transaction_date: string; required_by: string | null; notes: string | null;
  purchase_order_items: Item[];
}

export default async function EditPurchaseOrderPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, po_no, supplier_id, status, transaction_date, required_by, notes, purchase_order_items(product_id, qty, rate)")
    .eq("id", params.id)
    .single();
  const po = data as unknown as Order | null;
  if (!po) notFound();
  if (po.status !== "draft") redirect(`/purchase-orders/${po.id}`);

  const [suppliers, products] = await Promise.all([getSuppliers(), getProducts()]);
  const defaults: PurchaseOrderInput = {
    po_no: po.po_no ?? "",
    supplier_id: po.supplier_id ?? "",
    transaction_date: po.transaction_date,
    required_by: po.required_by ?? "",
    notes: po.notes ?? "",
    items: (po.purchase_order_items ?? []).map((it) => ({
      product_id: it.product_id,
      qty: Number(it.qty),
      rate: Number(it.rate),
    })),
  };
  if (defaults.items.length === 0) defaults.items = [{ product_id: "", qty: 1, rate: 0 }];

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href={`/purchase-orders/${po.id}`} className="hover:text-brand">← {t(locale, "Purchase order")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Edit purchase order")}</h1>
      <PurchaseOrderForm
        orderId={po.id}
        defaults={defaults}
        suppliers={suppliers.map((s) => ({ id: s.id as string, label: s.name as string }))}
        products={products.map((p) => ({ id: p.id as string, label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`, buy: Number(p.default_buy_price ?? 0) }))}
      />
    </div>
  );
}
