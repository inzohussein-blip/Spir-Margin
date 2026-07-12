import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  bom_no: string;
  quantity: number;
  uom: string | null;
  is_active: boolean;
  is_default: boolean;
  raw_material_cost: number;
  products: { name: string; item_code: string | null } | null;
  bom_items: { id: string }[];
}

export default async function BomsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("boms")
    .select("id, bom_no, quantity, uom, is_active, is_default, raw_material_cost, products(name, item_code), bom_items(id)")
    .order("created_at", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Bills of Materials</h1>
        <div className="flex gap-2">
          <Link href="/work-orders" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Work orders</Link>
          <Link href="/boms/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New BOM</Link>
        </div>
      </div>

      <Panel title={`BOMs (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No BOMs yet — define the components that assemble into a kit" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">BOM no.</th>
                  <th className="px-4 py-2">Finished product</th>
                  <th className="px-4 py-2">Yield</th>
                  <th className="px-4 py-2">Components</th>
                  <th className="px-4 py-2">Material cost</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td className="px-4 py-2 font-medium">{b.bom_no}</td>
                    <td className="px-4 py-2">{b.products?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{Number(b.quantity)} {b.uom ?? ""}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{b.bom_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(b.raw_material_cost).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        {b.is_default && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">default</span>}
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.is_active ? "bg-emerald-100 text-emerald-700" : "bg-surface-gray-2 text-ink-gray-6"}`}>
                          {b.is_active ? "active" : "inactive"}
                        </span>
                      </div>
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
