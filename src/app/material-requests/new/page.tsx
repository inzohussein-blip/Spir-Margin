import Link from "next/link";
import { getProducts, getWarehouses } from "@/lib/queries";
import { MaterialRequestForm } from "@/components/buying/MaterialRequestForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewMaterialRequestPage() {
  const locale = getLocale();
  const [products, warehouses] = await Promise.all([getProducts(), getWarehouses()]);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/material-requests" className="hover:text-brand">← {t(locale, "Material Requests")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Material Request")}</h1>
      <MaterialRequestForm
        products={products.map((p) => ({ id: p.id, label: `${p.name} (${p.item_code})` }))}
        warehouses={warehouses.map((w) => ({ id: w.id, label: w.name }))}
      />
    </div>
  );
}
