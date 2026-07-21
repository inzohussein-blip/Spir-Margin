import Link from "next/link";
import { getProducts, getLabs } from "@/lib/queries";
import { SaleForm } from "@/components/form/SaleForm";
import { FormCard } from "@/components/form/Fields";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const locale = getLocale();
  const [products, labs] = await Promise.all([getProducts(), getLabs()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/" className="hover:text-brand">
          ← Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Record Sale")}</h1>
      <FormCard title={t(locale, "Sell a product to a lab")}>
        <SaleForm products={products as never} labs={labs as never} />
      </FormCard>
    </div>
  );
}
