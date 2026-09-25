import Link from "next/link";
import { getProducts, getLabs } from "@/lib/queries";
import { SalesOrderForm } from "@/components/selling/SalesOrderForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { copySalesOrder } from "@/lib/copy-docs";

export const dynamic = "force-dynamic";

export default async function NewSalesOrderPage({ searchParams }: { searchParams: { from?: string } }) {
  const locale = getLocale();
  const [products, labs, copied] = await Promise.all([
    getProducts(), getLabs(), searchParams.from ? copySalesOrder(searchParams.from) : null,
  ]);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/sales-orders" className="hover:text-brand">← {t(locale, "Sales Orders")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Sales Order")}</h1>
      <SalesOrderForm
        defaults={copied ?? undefined}
        labs={labs.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` }))}
        products={products.map((p) => ({
          id: p.id,
          label: `${p.name} (${p.item_code})`,
          sell: Number(p.default_sell_price),
        }))}
      />
    </div>
  );
}
