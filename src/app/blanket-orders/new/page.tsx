import Link from "next/link";
import { getLabs, getSuppliers, getProducts } from "@/lib/queries";
import { BlanketOrderForm } from "@/components/selling/BlanketOrderForm";

export const dynamic = "force-dynamic";

export default async function NewBlanketOrderPage() {
  const [labs, suppliers, products] = await Promise.all([getLabs(), getSuppliers(), getProducts()]);
  const labOpts = labs.map((l) => ({ id: l.id as string, label: l.name as string }));
  const supplierOpts = suppliers.map((s) => ({ id: s.id as string, label: s.name as string }));
  const productOpts = products.map((p) => ({
    id: p.id as string,
    label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
    buy: Number(p.default_buy_price ?? 0),
    sell: Number(p.default_sell_price ?? 0),
  }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/blanket-orders" className="hover:text-brand">← Blanket orders</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Blanket Order</h1>
      <BlanketOrderForm labs={labOpts} suppliers={supplierOpts} products={productOpts} />
    </div>
  );
}
