import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const pct = (p: number, r: number) => (r > 0 ? `${Math.round((p / r) * 100)}%` : "—");

interface Row { product_id: string; item_code: string | null; product_name: string; qty: number; revenue: number; cost: number; profit: number; }

export default async function ProfitabilityReport() {
  const supabase = createClient();
  const { data } = await supabase.from("v_profitability").select("*").order("profit", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const t = rows.reduce((a, r) => ({ rev: a.rev + Number(r.revenue), cost: a.cost + Number(r.cost), profit: a.profit + Number(r.profit) }), { rev: 0, cost: 0, profit: 0 });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="Revenue" value={money(t.rev)} accent="brand" />
        <StatCard label="Cost" value={money(t.cost)} accent="amber" />
        <StatCard label="Gross profit" value={money(t.profit)} accent="green" />
        <StatCard label="Margin" value={pct(t.profit, t.rev)} accent="green" />
      </div>

      <ListShell
        title="Profitability by Product"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Reports", href: "/reports" }, { label: "Profitability" }]}
        count={rows.length}
        filterPlaceholder="Filter by product…"
      >
        {rows.length === 0 ? <EmptyRow text="No sales recorded yet" /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">Product</th><th className="px-4 py-2 text-right">Qty</th>
                <th className="px-4 py-2 text-right">Revenue</th><th className="px-4 py-2 text-right">Cost</th>
                <th className="px-4 py-2 text-right">Profit</th><th className="px-4 py-2 text-right">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {rows.map((r) => (
                <tr key={r.product_id} className="hover:bg-surface-gray-1">
                  <td className="px-4 py-2 font-medium">{r.product_name}{r.item_code ? <span className="ml-1 text-xs text-ink-gray-4">({r.item_code})</span> : null}</td>
                  <td className="px-4 py-2 text-right">{Number(r.qty)}</td>
                  <td className="px-4 py-2 text-right">{money(Number(r.revenue))}</td>
                  <td className="px-4 py-2 text-right text-ink-gray-5">{money(Number(r.cost))}</td>
                  <td className={`px-4 py-2 text-right font-medium ${Number(r.profit) >= 0 ? "text-emerald-700" : "text-red-700"}`}>{money(Number(r.profit))}</td>
                  <td className="px-4 py-2 text-right text-ink-gray-5">{pct(Number(r.profit), Number(r.revenue))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr className="border-t border-outline-gray-2 font-semibold"><td className="px-4 py-2">Total</td><td /><td className="px-4 py-2 text-right">{money(t.rev)}</td><td className="px-4 py-2 text-right">{money(t.cost)}</td><td className="px-4 py-2 text-right">{money(t.profit)}</td><td className="px-4 py-2 text-right">{pct(t.profit, t.rev)}</td></tr></tfoot>
          </table>
        )}
      </ListShell>
    </div>
  );
}
