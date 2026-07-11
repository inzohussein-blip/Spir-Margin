import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StockReconForm } from "@/components/stock/StockReconForm";

export const dynamic = "force-dynamic";

export default async function NewStockReconPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("kit_batches")
    .select("id, batch_no, qty_available, products(name)")
    .order("batch_no");
  const batches = (data as unknown as { id: string; batch_no: string; qty_available: number; products: { name: string } | null }[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/stock-reconciliation" className="hover:text-brand">← Stock Reconciliation</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Stock Count</h1>
      <StockReconForm
        batches={batches.map((b) => ({ id: b.id, label: `${b.batch_no} (${b.products?.name ?? ""})`, available: Number(b.qty_available) }))}
      />
    </div>
  );
}
