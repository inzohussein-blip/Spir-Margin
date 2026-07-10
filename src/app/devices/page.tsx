import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

interface DeviceRow {
  id: string;
  asset_code: string;
  serial_no: string | null;
  status: string;
  next_maintenance_date: string | null;
  products: { name: string } | null;
  labs: { name: string } | null;
}

const statusColor: Record<string, string> = {
  installed: "bg-emerald-100 text-emerald-700",
  in_stock: "bg-slate-100 text-slate-600",
  in_maintenance: "bg-amber-100 text-amber-700",
  out_of_order: "bg-red-100 text-red-700",
  retired: "bg-slate-100 text-slate-400",
};

export default async function DevicesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("devices")
    .select(
      "id, asset_code, serial_no, status, next_maintenance_date, products(name), labs(name)"
    )
    .order("asset_code");
  const devices = (data as unknown as DeviceRow[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Devices</h1>
        <Link
          href="/devices/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + New device
        </Link>
      </div>
      <Panel title={`All Devices (${devices.length})`}>
        {devices.length === 0 ? (
          <EmptyRow text="No devices yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="px-4 py-2">Asset code</th>
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Serial</th>
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Next maintenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2 font-medium">{d.asset_code}</td>
                    <td className="px-4 py-2">{d.products?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {d.serial_no ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {d.labs?.name ?? "unassigned"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          statusColor[d.status] ?? "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {d.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {d.next_maintenance_date ?? "—"}
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
