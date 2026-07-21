import Link from "next/link";
import { getProducts, getWarehouses } from "@/lib/queries";
import { BomForm } from "@/components/manufacturing/BomForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewBomPage() {
  const locale = getLocale();
  const [products, warehouses] = await Promise.all([getProducts(), getWarehouses()]);
  const productOpts = products.map((p) => ({
    id: p.id as string,
    label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
    type: p.product_type as string,
    buy: Number(p.default_buy_price ?? 0),
  }));
  const warehouseOpts = warehouses.map((w) => ({ id: w.id as string, label: w.name as string }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/boms" className="hover:text-brand">← {t(locale, "BOMs")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New BOM")}</h1>
      <BomForm products={productOpts} warehouses={warehouseOpts} />
    </div>
  );
}
