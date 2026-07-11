import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { convertMaterialRequestForm } from "@/app/actions/material";

export const dynamic = "force-dynamic";

interface Row {
  id: string; transaction_date: string; required_by: string | null; status: string;
  material_request_items: { id: string }[];
}
const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  ordered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function MaterialRequestsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("material_requests")
    .select("id, transaction_date, required_by, status, material_request_items(id)")
    .order("transaction_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Material Requests</h1>
        <div className="flex gap-2">
          <Link href="/purchases" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Purchases</Link>
          <Link href="/material-requests/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New request</Link>
        </div>
      </div>
      <Panel title={`Requests (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No material requests — request items, then convert to a purchase" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Date</th><th className="px-4 py-2">Required by</th>
                  <th className="px-4 py-2">Items</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td className="px-4 py-2 text-ink-gray-5">{m.transaction_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{m.required_by ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{m.material_request_items?.length ?? 0}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[m.status] ?? "bg-surface-gray-2"}`}>{m.status}</span></td>
                    <td className="px-4 py-2">
                      {m.status === "draft" ? (
                        <form action={convertMaterialRequestForm}>
                          <input type="hidden" name="id" value={m.id} />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">→ Purchase</button>
                        </form>
                      ) : <span className="text-xs text-ink-gray-4">—</span>}
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
