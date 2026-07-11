import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

interface Row {
  id: string; account_name: string; account_number: string | null;
  root_type: string; account_type: string | null; is_group: boolean; parent_account: string | null;
}

const rootBadge: Record<string, string> = {
  asset: "bg-blue-100 text-blue-700",
  liability: "bg-amber-100 text-amber-700",
  income: "bg-emerald-100 text-emerald-700",
  expense: "bg-red-100 text-red-700",
  equity: "bg-surface-gray-2 text-ink-gray-6",
};

export default async function AccountsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("accounts")
    .select("id, account_name, account_number, root_type, account_type, is_group, parent_account")
    .order("account_number", { nullsFirst: false });
  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Chart of Accounts</h1>
        <div className="flex gap-2">
          <Link href="/journal-entries" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Journal entries</Link>
          <Link href="/accounts/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New account</Link>
        </div>
      </div>
      <Panel title={`Accounts (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No accounts yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">No.</th>
                  <th className="px-4 py-2">Account</th>
                  <th className="px-4 py-2">Root</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Parent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((a) => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 text-ink-gray-5">{a.account_number ?? "—"}</td>
                    <td className={`px-4 py-2 ${a.is_group ? "font-semibold text-ink-gray-8" : "pl-8 text-ink-gray-7"}`}>{a.account_name}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${rootBadge[a.root_type] ?? "bg-surface-gray-2"}`}>{a.root_type}</span>
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{a.account_type ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{a.parent_account ?? "—"}</td>
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
