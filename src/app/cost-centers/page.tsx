import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

export default async function CostCentersPage() {
  const supabase = createClient();
  const { data } = await supabase.from("cost_centers").select("id, name, cost_center_number, is_group, parent_cost_center").order("name");
  const rows = (data as { id: string; name: string; cost_center_number: string | null; is_group: boolean; parent_cost_center: string | null }[]) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Cost Centers</h1>
        <Link href="/accounts" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">← Accounts</Link>
      </div>
      <Panel title={`Cost Centers (${rows.length})`}>
        {rows.length === 0 ? <EmptyRow text="No cost centers" /> : (
          <ul className="divide-y divide-outline-gray-1">
            {rows.map((c) => (
              <li key={c.id} className={`px-4 py-2 text-sm ${c.is_group ? "font-semibold text-ink-gray-8" : "pl-8 text-ink-gray-7"}`}>{c.name}</li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
