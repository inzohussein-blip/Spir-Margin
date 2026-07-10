import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

interface KitRow {
  id: string;
  batch_no: string;
  expiry_date: string | null;
  qty_available: number;
  buy_price: number;
  sell_price: number;
  products: { name: string } | null;
  warehouses: { name: string } | null;
}

export default async function KitsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("kit_batches")
    .select(
      "id, batch_no, expiry_date, qty_available, buy_price, sell_price, products(name), warehouses(name)"
    )
    .order("expiry_date");
  const kits = (data as unknown as KitRow[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Reagent Kits</h1>
        <div className="flex gap-2">
          <Link
            href="/kits/withdraw"
            className="rounded-md border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-blue-50"
          >
            Record withdrawal
          </Link>
          <Link
            href="/kits/new"
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + New batch
          </Link>
        </div>
      </div>
      <Panel title={`All Batches (${kits.length})`}>
        {kits.length === 0 ? (
          <EmptyRow text="No kit batches yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Batch</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Warehouse</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Buy</th>
                  <th className="px-4 py-2">Sell</th>
                  <th className="px-4 py-2">Margin</th>
                  <th className="px-4 py-2">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {kits.map((k) => {
                  const margin = Number(k.sell_price) - Number(k.buy_price);
                  return (
                    <tr key={k.id}>
                      <td className="px-4 py-2 font-medium">{k.batch_no}</td>
                      <td className="px-4 py-2">{k.products?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-ink-gray-5">
                        {k.warehouses?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2">{Number(k.qty_available)}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{k.buy_price}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{k.sell_price}</td>
                      <td className="px-4 py-2 font-medium text-emerald-600">
                        +{margin}
                      </td>
                      <td className="px-4 py-2 text-ink-gray-5">
                        {k.expiry_date ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
