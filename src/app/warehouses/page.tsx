import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

interface WarehouseRow {
  id: string;
  name: string;
  warehouse_type: string | null;
  city: string | null;
  phone: string | null;
  is_disabled: boolean;
}

export default async function WarehousesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("warehouses")
    .select("id, name, warehouse_type, city, phone, is_disabled")
    .order("name");
  const rows = (data as WarehouseRow[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Warehouses</h1>
        <Link
          href="/warehouses/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + New warehouse
        </Link>
      </div>
      <Panel title={`All Warehouses (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No warehouses yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">City</th>
                  <th className="px-4 py-2">Phone</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((w) => (
                  <tr key={w.id} className={w.is_disabled ? "opacity-50" : ""}>
                    <td className="px-4 py-2 font-medium">{w.name}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {w.warehouse_type ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{w.city ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-500">{w.phone ?? "—"}</td>
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
