import Link from "next/link";
import { getSuppliers, getProducts, getWarehouses } from "@/lib/queries";
import { PurchaseReceiptForm } from "@/components/purchasing/PurchaseReceiptForm";

export const dynamic = "force-dynamic";

export default async function NewPurchaseReceiptPage() {
  const [suppliers, products, warehouses] = await Promise.all([getSuppliers(), getProducts(), getWarehouses()]);
  const supplierOpts = suppliers.map((s) => ({ id: s.id as string, label: s.name as string }));
  const productOpts = products.map((p) => ({
    id: p.id as string,
    label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
    buy: Number(p.default_buy_price ?? 0),
  }));
  const warehouseOpts = warehouses.map((w) => ({ id: w.id as string, label: w.name as string }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/purchase-receipts" className="hover:text-brand">← Purchase receipts</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Purchase Receipt</h1>
      <PurchaseReceiptForm suppliers={supplierOpts} products={productOpts} warehouses={warehouseOpts} />
    </div>
  );
}
