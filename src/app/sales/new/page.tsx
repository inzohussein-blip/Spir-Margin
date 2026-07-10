import Link from "next/link";
import { getProducts, getLabs } from "@/lib/queries";
import { SaleForm } from "@/components/form/SaleForm";
import { FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const [products, labs] = await Promise.all([getProducts(), getLabs()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/" className="hover:text-brand">
          ← Dashboard
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Record Sale</h1>
      <FormCard title="Sell a product to a lab">
        <SaleForm products={products as never} labs={labs as never} />
      </FormCard>
    </div>
  );
}
