import Link from "next/link";
import { getLabs, getProducts } from "@/lib/queries";
import { SalesInvoiceForm } from "@/components/selling/SalesInvoiceForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewSalesInvoicePage() {
  const locale = getLocale();
  const [labs, products] = await Promise.all([getLabs(), getProducts()]);
  const labOpts = labs.map((l) => ({ id: l.id as string, label: l.name as string }));
  const productOpts = products.map((p) => ({
    id: p.id as string,
    label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
    sell: Number(p.default_sell_price ?? 0),
  }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/sales-invoices" className="hover:text-brand">← {t(locale, "Sales invoices")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Sales Invoice")}</h1>
      <SalesInvoiceForm labs={labOpts} products={productOpts} />
    </div>
  );
}
