import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { setIssueStatusForm } from "@/app/actions/support";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  issue_no: string;
  subject: string;
  status: string;
  priority: string | null;
  issue_type: string | null;
  opening_date: string;
  labs: { name: string } | null;
  devices: { asset_code: string } | null;
}

const statusBadge: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  replied: "bg-blue-100 text-blue-700",
  on_hold: "bg-orange-100 text-orange-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-surface-gray-2 text-ink-gray-6",
};
const prioBadge: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700",
  High: "bg-orange-100 text-orange-700",
  Medium: "bg-amber-100 text-amber-700",
  Low: "bg-surface-gray-2 text-ink-gray-6",
};

export default async function IssuesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("issues")
    .select("id, issue_no, subject, status, priority, issue_type, opening_date, labs(name), devices(asset_code)")
    .order("opening_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const open = rows.filter((r) => r.status !== "resolved" && r.status !== "closed").length;
  const resolved = rows.filter((r) => r.status === "resolved" || r.status === "closed").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Support Issues</h1>
        <Link href="/issues/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New issue</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open" value={String(open)} accent="amber" />
        <StatCard label="Resolved / closed" value={String(resolved)} accent="green" />
        <StatCard label="Total" value={String(rows.length)} accent="brand" />
      </div>

      <Panel title={`Issues (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No support issues yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">No.</th>
                  <th className="px-4 py-2">Subject</th>
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Device</th>
                  <th className="px-4 py-2">Priority</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/issues/${i.id}`} className="text-brand hover:underline">{i.issue_no}</Link>
                    </td>
                    <td className="px-4 py-2">{i.subject}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{i.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{i.devices?.asset_code ?? "—"}</td>
                    <td className="px-4 py-2">
                      {i.priority ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${prioBadge[i.priority] ?? "bg-surface-gray-2"}`}>{i.priority}</span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{i.opening_date}</td>
                    <td className="px-4 py-2">
                      <form action={setIssueStatusForm} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={i.id} />
                        <select name="status" defaultValue={i.status} className="rounded-md border border-outline-gray-2 px-2 py-1 text-xs">
                          <option value="open">open</option>
                          <option value="replied">replied</option>
                          <option value="on_hold">on hold</option>
                          <option value="resolved">resolved</option>
                          <option value="closed">closed</option>
                        </select>
                        <button className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark">Set</button>
                      </form>
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
