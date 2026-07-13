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

interface InvoiceRow {
  id: string;
  invoice_no: string;
  outstanding: number;
  status: string;
  labs: { name: string } | null;
}
interface PoRow {
  id: string;
  po_no: string;
  total_amount: number;
  status: string;
  companies: { name: string } | null;
}

interface PmVisitRow {
  id: string;
  scheduled_date: string;
  maintenance_schedules: {
    schedule_no: string;
    devices: { asset_code: string; products: { name: string } | null } | null;
    labs: { name: string } | null;
  } | null;
}

export default async function DashboardPage() {
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + 60 * 86400_000).toISOString().slice(0, 10);

  const [
    profitRes,
    labsRes,
    maintRes,
    kitsRes,
    invRes,
    poRes,
    woRes,
    repairRes,
    pmRes,
  ] = await Promise.all([
    supabase.from("v_profit_summary").select("*").single(),
    supabase.from("v_active_labs").select("*").order("name"),
    supabase.from("v_maintenance_alerts").select("*").limit(10),
    supabase.from("v_expiring_kits").select("*").limit(10),
    supabase
      .from("sales_invoices")
      .select("id, invoice_no, outstanding, status, labs(name)")
      .neq("status", "cancelled")
      .gt("outstanding", 0)
      .order("outstanding", { ascending: false }),
    supabase
      .from("purchase_orders")
      .select("id, po_no, total_amount, status, companies:supplier_id(name)")
      .in("status", ["draft", "submitted"])
      .order("total_amount", { ascending: false }),
    supabase.from("work_orders").select("status").in("status", ["draft", "in_process"]),
    supabase.from("asset_repairs").select("status").eq("status", "pending"),
    // upcoming preventive-maintenance visits (next 60 days, not yet done)
    supabase
      .from("maintenance_schedule_details")
      .select(
        "id, scheduled_date, maintenance_schedules(schedule_no, devices(asset_code, products(name)), labs(name))"
      )
      .eq("completion_status", "pending")
      .gte("scheduled_date", today)
      .lte("scheduled_date", horizon)
      .order("scheduled_date", { ascending: true })
      .limit(12),
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
  const invoices = (invRes.data as InvoiceRow[]) ?? [];
  const pos = (poRes.data as PoRow[]) ?? [];
  const openWorkOrders = (woRes.data as { status: string }[])?.length ?? 0;
  const pendingRepairs = (repairRes.data as { status: string }[])?.length ?? 0;
  const pmVisits = (pmRes.data as PmVisitRow[]) ?? [];
  const daysUntil = (d: string) =>
    Math.round((new Date(d).getTime() - Date.now()) / 86400_000);

  const outstandingTotal = invoices.reduce((s, i) => s + Number(i.outstanding), 0);
  const poTotal = pos.reduce((s, p) => s + Number(p.total_amount), 0);

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

      {/* Operations KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Outstanding Receivables"
          value={money(outstandingTotal)}
          hint={`${invoices.length} open invoice${invoices.length === 1 ? "" : "s"}`}
          accent="amber"
        />
        <StatCard
          label="Open Purchase Orders"
          value={String(pos.length)}
          hint={`value ${money(poTotal)}`}
          accent="brand"
        />
        <StatCard
          label="Active Work Orders"
          value={String(openWorkOrders)}
          hint="kit assembly in progress"
          accent="green"
        />
        <StatCard
          label="Pending Repairs"
          value={String(pendingRepairs)}
          hint="devices under repair"
          accent="red"
        />
      </div>

      {/* Receivables + open POs */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Outstanding Invoices">
          {invoices.length === 0 ? (
            <EmptyRow text="No open receivables" />
          ) : (
            <ul className="divide-y divide-outline-gray-1">
              {invoices.slice(0, 8).map((inv) => (
                <li key={inv.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-ink-gray-8">{inv.invoice_no}</div>
                    <div className="text-xs text-ink-gray-4">{inv.labs?.name ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-ink-gray-8">{money(Number(inv.outstanding))}</div>
                    <div className="text-xs text-ink-gray-4">{inv.status.replace("_", " ")}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Open Purchase Orders">
          {pos.length === 0 ? (
            <EmptyRow text="No open purchase orders" />
          ) : (
            <ul className="divide-y divide-outline-gray-1">
              {pos.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div>
                    <div className="font-medium text-ink-gray-8">{p.po_no}</div>
                    <div className="text-xs text-ink-gray-4">{p.companies?.name ?? "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-ink-gray-8">{money(Number(p.total_amount))}</div>
                    <div className="text-xs text-ink-gray-4">{p.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
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

      {/* Upcoming preventive maintenance — full width */}
      <Panel title="Upcoming Maintenance (PM Schedule · ≤ 60 days)">
        {pmVisits.length === 0 ? (
          <EmptyRow text="No scheduled visits in the next 60 days" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Due</th>
                  <th className="px-4 py-2">Device</th>
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Schedule</th>
                  <th className="px-4 py-2">In</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {pmVisits.map((v) => {
                  const sc = v.maintenance_schedules;
                  const d = daysUntil(v.scheduled_date);
                  return (
                    <tr key={v.id}>
                      <td className="px-4 py-2 font-medium">{v.scheduled_date}</td>
                      <td className="px-4 py-2">
                        {sc?.devices?.asset_code ?? "—"}
                        {sc?.devices?.products?.name ? (
                          <span className="text-ink-gray-4"> · {sc.devices.products.name}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-ink-gray-5">{sc?.labs?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{sc?.schedule_no ?? "—"}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            d <= 7 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {d}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

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
