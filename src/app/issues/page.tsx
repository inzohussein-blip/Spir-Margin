import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { Indicator } from "@/components/desk/Indicator";
import { EmptyRow } from "@/components/dashboard/Panel";
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

  return (
    <ListShell
      title="Support Issues"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Support" }]}
      count={rows.length}
      newHref="/issues/new"
      newLabel="New issue"
    >
      {rows.length === 0 ? (
        <EmptyRow text="No support issues yet" />
      ) : (
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
              <tr key={i.id} className="hover:bg-surface-gray-1">
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
                    <Indicator status={i.status} />
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ListShell>
  );
}
