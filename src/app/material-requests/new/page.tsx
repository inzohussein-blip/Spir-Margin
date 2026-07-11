import Link from "next/link";
import { getProducts, getWarehouses } from "@/lib/queries";
import { MaterialRequestForm } from "@/components/buying/MaterialRequestForm";

export const dynamic = "force-dynamic";

export default async function NewMaterialRequestPage() {
  const [products, warehouses] = await Promise.all([getProducts(), getWarehouses()]);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/material-requests" className="hover:text-brand">← Material Requests</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Material Request</h1>
      <MaterialRequestForm
        products={products.map((p) => ({ id: p.id, label: `${p.name} (${p.item_code})` }))}
        warehouses={warehouses.map((w) => ({ id: w.id, label: w.name }))}
      />
    </div>
  );
}
