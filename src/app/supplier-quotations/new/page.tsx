import Link from "next/link";
import { getProducts, getSuppliers } from "@/lib/queries";
import { SupplierQuotationForm } from "@/components/buying/SupplierQuotationForm";

export const dynamic = "force-dynamic";

export default async function NewSupplierQuotationPage() {
  const [products, suppliers] = await Promise.all([getProducts(), getSuppliers()]);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/supplier-quotations" className="hover:text-brand">← Supplier Quotations</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Supplier Quotation</h1>
      <SupplierQuotationForm
        suppliers={suppliers.map((s) => ({ id: s.id, label: s.name }))}
        products={products.map((p) => ({ id: p.id, label: `${p.name} (${p.item_code})`, buy: Number(p.default_buy_price) }))}
      />
    </div>
  );
}
