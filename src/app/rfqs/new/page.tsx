import Link from "next/link";
import { getProducts, getSuppliers } from "@/lib/queries";
import { RfqForm } from "@/components/buying/RfqForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewRfqPage() {
  const locale = getLocale();
  const [products, suppliers] = await Promise.all([getProducts(), getSuppliers()]);
  const productOpts = products.map((p) => ({
    id: p.id as string,
    label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
  }));
  const supplierOpts = suppliers.map((s) => ({ id: s.id as string, label: s.name as string }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/rfqs" className="hover:text-brand">← {t(locale, "Requests for quotation")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Request for Quotation")}</h1>
      <RfqForm products={productOpts} suppliers={supplierOpts} />
    </div>
  );
}
