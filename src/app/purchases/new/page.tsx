import Link from "next/link";
import { getProducts, getSuppliers, getWarehouses, getPaymentTerms } from "@/lib/queries";
import { PurchaseForm } from "@/components/purchasing/PurchaseForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const locale = getLocale();
  const [products, suppliers, warehouses, terms] = await Promise.all([
    getProducts(),
    getSuppliers(),
    getWarehouses(),
    getPaymentTerms(),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/purchases" className="hover:text-brand">← {t(locale, "Purchases")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Purchase")}</h1>
      <PurchaseForm
        suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
        products={products.map((p) => ({
          id: p.id,
          label: `${p.name} (${p.item_code})`,
          type: p.product_type,
          buy: Number(p.default_buy_price),
        }))}
        warehouses={warehouses.map((w) => ({ id: w.id, label: w.name }))}
        terms={terms.map((t) => ({ id: t.id, label: t.name }))}
      />
    </div>
  );
}
