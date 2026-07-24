import Link from "next/link";
import { getProducts, getLabs } from "@/lib/queries";
import { SalesReturnForm } from "@/components/selling/SalesReturnForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewSalesReturnPage() {
  const locale = getLocale();
  const [products, labs] = await Promise.all([getProducts(), getLabs()]);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/sales-returns" className="hover:text-brand">← {t(locale, "Sales Returns")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Sales Return")}</h1>
      <SalesReturnForm
        labs={labs.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` }))}
        products={products.map((p) => ({ id: p.id, label: `${p.name} (${p.item_code})`, sell: Number(p.default_sell_price) }))}
      />
    </div>
  );
}
