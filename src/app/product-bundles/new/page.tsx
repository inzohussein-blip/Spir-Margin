import Link from "next/link";
import { getProducts } from "@/lib/queries";
import { ProductBundleForm } from "@/components/selling/ProductBundleForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewProductBundlePage() {
  const locale = getLocale();
  const products = await getProducts();
  const productOpts = products.map((p) => ({
    id: p.id as string,
    label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
    sell: Number(p.default_sell_price ?? 0),
  }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/product-bundles" className="hover:text-brand">← {t(locale, "Product bundles")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Product Bundle")}</h1>
      <ProductBundleForm products={productOpts} />
    </div>
  );
}
