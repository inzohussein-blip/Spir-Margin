import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import type { Lab } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LabsPage() {
  const supabase = createClient();
  const { data } = await supabase.from("labs").select("*").order("name");
  const labs = (data as Lab[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Labs</h1>
        <Link
          href="/labs/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + New lab
        </Link>
      </div>
      <Panel title={`All Labs (${labs.length})`}>
        {labs.length === 0 ? (
          <EmptyRow text="No labs yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">City</th>
                  <th className="px-4 py-2">Contact</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Last activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {labs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2 font-medium">{l.code}</td>
                    <td className="px-4 py-2">{l.name}</td>
                    <td className="px-4 py-2 text-slate-500">{l.city ?? "—"}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {l.contact_name ?? "—"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          l.status === "active"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-500">
                      {l.last_activity_at
                        ? new Date(l.last_activity_at).toLocaleDateString()
                        : "—"}
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
