import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row {
  product_id: string;
  item_code: string | null;
  product_name: string;
  warehouse_name: string;
  qty: number;
  stock_value: number;
  batches: number;
}

export default async function StockBalancePage() {
  const supabase = createClient();
  const { data } = await supabase.from("v_stock_balance").select("*");
  const rows = (data as unknown as Row[]) ?? [];
  const totalValue = rows.reduce((s, r) => s + Number(r.stock_value), 0);

  return (
    <ListShell
      title="Stock Balance"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Stock" }]}
      count={rows.length}
      filterPlaceholder="Filter by product / warehouse…"
    >
      {rows.length === 0 ? (
        <EmptyRow text="No stock on hand" />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">Item code</th>
              <th className="px-4 py-2">Product</th>
              <th className="px-4 py-2">Warehouse</th>
              <th className="px-4 py-2 text-right">Qty</th>
              <th className="px-4 py-2 text-right">Batches</th>
              <th className="px-4 py-2 text-right">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-gray-1">
            {rows.map((r) => (
              <tr key={`${r.product_id}-${r.warehouse_name}`} className="hover:bg-surface-gray-1">
                <td className="px-4 py-2 font-medium">{r.item_code ?? "—"}</td>
                <td className="px-4 py-2">{r.product_name}</td>
                <td className="px-4 py-2 text-ink-gray-5">{r.warehouse_name}</td>
                <td className="px-4 py-2 text-right">{Number(r.qty)}</td>
                <td className="px-4 py-2 text-right text-ink-gray-5">{Number(r.batches)}</td>
                <td className="px-4 py-2 text-right">{money(Number(r.stock_value))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-outline-gray-2 font-semibold">
              <td className="px-4 py-2" colSpan={5}>Total stock value</td>
              <td className="px-4 py-2 text-right">{money(totalValue)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </ListShell>
  );
}
