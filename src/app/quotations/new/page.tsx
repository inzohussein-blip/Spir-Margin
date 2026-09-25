import Link from "next/link";
import { getProducts, getLabs } from "@/lib/queries";
import { QuotationForm } from "@/components/selling/QuotationForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";
import { copyQuotation } from "@/lib/copy-docs";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage({ searchParams }: { searchParams: { from?: string } }) {
  const locale = getLocale();
  const [products, labs, copied] = await Promise.all([
    getProducts(), getLabs(), searchParams.from ? copyQuotation(searchParams.from) : null,
  ]);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/quotations" className="hover:text-brand">← {t(locale, "Quotations")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Quotation")}</h1>
      <QuotationForm
        defaults={copied ?? undefined}
        labs={labs.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` }))}
        products={products.map((p) => ({ id: p.id, label: `${p.name} (${p.item_code})`, sell: Number(p.default_sell_price) }))}
      />
    </div>
  );
}
