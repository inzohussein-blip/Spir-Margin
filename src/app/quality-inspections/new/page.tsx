import Link from "next/link";
import { getProducts, getKitBatches } from "@/lib/queries";
import { QualityInspectionForm } from "@/components/quality/QualityInspectionForm";

export const dynamic = "force-dynamic";

export default async function NewQualityInspectionPage() {
  const [products, batches] = await Promise.all([getProducts(), getKitBatches()]);
  const productOpts = products.map((p) => ({
    id: p.id as string,
    label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
  }));
  const batchOpts = batches.map((b) => {
    const prod = (b as { products?: { name?: string } | null }).products;
    return {
      id: b.id as string,
      label: `${b.batch_no as string}${prod?.name ? ` · ${prod.name}` : ""}`,
    };
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/quality-inspections" className="hover:text-brand">← Quality inspections</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Quality Inspection</h1>
      <QualityInspectionForm products={productOpts} batches={batchOpts} />
    </div>
  );
}
