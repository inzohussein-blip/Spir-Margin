import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLabs, getProducts, getWarehouses } from "@/lib/queries";
import { PickListForm } from "@/components/stock/PickListForm";

export const dynamic = "force-dynamic";

interface SoRow {
  id: string;
  transaction_date: string;
  status: string;
  labs: { name: string } | null;
}

export default async function NewPickListPage() {
  const supabase = createClient();
  const [labs, products, warehouses, { data: soData }] = await Promise.all([
    getLabs(),
    getProducts(),
    getWarehouses(),
    supabase
      .from("sales_orders")
      .select("id, transaction_date, status, labs(name)")
      .in("status", ["draft", "confirmed"])
      .order("transaction_date", { ascending: false }),
  ]);

  const labOpts = labs.map((l) => ({ id: l.id as string, label: l.name as string }));
  const productOpts = products.map((p) => ({
    id: p.id as string,
    label: `${p.name}${p.item_code ? ` (${p.item_code})` : ""}`,
  }));
  const warehouseOpts = warehouses.map((w) => ({ id: w.id as string, label: w.name as string }));
  const soOpts = ((soData as unknown as SoRow[]) ?? []).map((s) => ({
    id: s.id,
    label: `${s.labs?.name ?? "Order"} — ${s.transaction_date}`,
  }));

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/pick-lists" className="hover:text-brand">← Pick lists</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Pick List</h1>
      <PickListForm labs={labOpts} salesOrders={soOpts} products={productOpts} warehouses={warehouseOpts} />
    </div>
  );
}
