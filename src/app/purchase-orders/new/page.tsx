import Link from "next/link";
import { getSuppliers, getProducts } from "@/lib/queries";
import { PurchaseOrderForm } from "@/components/purchasing/PurchaseOrderForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewPurchaseOrderPage() {
  const locale = getLocale();
  const [suppliers, products] = await Promise.all([getSuppliers(), getProducts()]);
  const supplierOpts = suppliers.map((s) => ({ id: s.id as string, label: s.name as string }));
  const productOpts = products.map((p) => ({
    id: p.id as string,
    label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
    buy: Number(p.default_buy_price ?? 0),
  }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/purchase-orders" className="hover:text-brand">← {t(locale, "Purchase orders")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Purchase Order")}</h1>
      <PurchaseOrderForm suppliers={supplierOpts} products={productOpts} />
    </div>
  );
}
