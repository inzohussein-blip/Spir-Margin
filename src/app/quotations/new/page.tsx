import Link from "next/link";
import { getProducts, getLabs } from "@/lib/queries";
import { QuotationForm } from "@/components/selling/QuotationForm";

export const dynamic = "force-dynamic";

export default async function NewQuotationPage() {
  const [products, labs] = await Promise.all([getProducts(), getLabs()]);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/quotations" className="hover:text-brand">← Quotations</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Quotation</h1>
      <QuotationForm
        labs={labs.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` }))}
        products={products.map((p) => ({ id: p.id, label: `${p.name} (${p.item_code})`, sell: Number(p.default_sell_price) }))}
      />
    </div>
  );
}
