import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatCard } from "@/components/dashboard/StatCard";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import type {
  ProfitSummary,
  ActiveLab,
  MaintenanceAlert,
  ExpiringKit,
} from "@/lib/types";

export const dynamic = "force-dynamic";

function money(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n || 0);
}

// Renders a friendly notice if Supabase env vars are missing.
function needsConfig() {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export default async function DashboardPage() {
  if (needsConfig()) {
    return (
      <div className="max-w-xl rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <h1 className="text-lg font-bold">⚙️ Setup required</h1>
        <p className="mt-2 text-sm">
          Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your environment (see{" "}
          <code>.env.example</code>), then run the migrations in{" "}
          <code>supabase/migrations</code>.
        </p>
      </div>
    );
  }

  const supabase = createClient();

  const [profitRes, labsRes, maintRes, kitsRes] = await Promise.all([
    supabase.from("v_profit_summary").select("*").single(),
    supabase.from("v_active_labs").select("*").order("name"),
    supabase.from("v_maintenance_alerts").select("*").limit(10),
    supabase.from("v_expiring_kits").select("*").limit(10),
  ]);

  const profit = (profitRes.data as ProfitSummary) ?? {
    total_profit: 0,
    total_revenue: 0,
    total_cost: 0,
    sales_count: 0,
  };
  const labs = (labsRes.data as ActiveLab[]) ?? [];
  const alerts = (maintRes.data as MaintenanceAlert[]) ?? [];
  const kits = (kitsRes.data as ExpiringKit[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Dashboard</h1>
        <Link
          href="/sales/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + Record sale
        </Link>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Profit"
          value={money(profit.total_profit)}
          hint={`${profit.sales_count} sales · revenue ${money(
            profit.total_revenue
          )}`}
          accent="green"
        />
        <StatCard
          label="Active Labs"
          value={String(labs.length)}
          hint="labs with a live subscription"
          accent="brand"
        />
        <StatCard
          label="Maintenance Alerts"
          value={String(alerts.length)}
          hint="devices needing attention"
          accent="amber"
        />
        <StatCard
          label="Expiring Kits"
          value={String(kits.length)}
          hint="batches expiring ≤ 90 days"
          accent="red"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active labs */}
        <Panel title="Active Labs">
          {labs.length === 0 ? (
            <EmptyRow text="No active labs" />
          ) : (
            <ul className="divide-y divide-outline-gray-1">
              {labs.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium text-ink-gray-8">{l.name}</div>
                    <div className="text-xs text-ink-gray-4">
                      {l.code} · {l.city ?? "—"}
                    </div>
                  </div>
                  <div className="text-right text-xs text-ink-gray-5">
                    <div>{l.device_count} devices</div>
                    <div>{Number(l.total_withdrawn)} withdrawn</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        {/* Maintenance alerts */}
        <Panel title="Maintenance Alerts">
          {alerts.length === 0 ? (
            <EmptyRow text="No devices need maintenance" />
          ) : (
            <ul className="divide-y divide-outline-gray-1">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between px-4 py-3 text-sm"
                >
                  <div>
                    <div className="font-medium text-ink-gray-8">
                      {a.product_name}
                    </div>
                    <div className="text-xs text-ink-gray-4">
                      {a.asset_code} · {a.lab_name ?? "unassigned"}
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.days_until_due != null && a.days_until_due < 0
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {a.status === "out_of_order"
                      ? "Out of order"
                      : a.days_until_due != null
                      ? `${a.days_until_due}d`
                      : a.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Expiring kits — full width */}
      <Panel title="Kits Near Expiry (≤ 90 days)">
        {kits.length === 0 ? (
          <EmptyRow text="No kits nearing expiry" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Batch</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Warehouse</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Expiry</th>
                  <th className="px-4 py-2">Days left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {kits.map((k) => (
                  <tr key={k.id}>
                    <td className="px-4 py-2 font-medium">{k.batch_no}</td>
                    <td className="px-4 py-2">{k.product_name}</td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {k.warehouse_name ?? "—"}
                    </td>
                    <td className="px-4 py-2">{Number(k.qty_available)}</td>
                    <td className="px-4 py-2">{k.expiry_date}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          k.days_until_expiry <= 30
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {k.days_until_expiry}d
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
