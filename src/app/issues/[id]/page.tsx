import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/dashboard/Panel";
import { resolveIssueForm } from "@/app/actions/support";

export const dynamic = "force-dynamic";

const statusBadge: Record<string, string> = {
  open: "bg-amber-100 text-amber-700",
  replied: "bg-blue-100 text-blue-700",
  on_hold: "bg-orange-100 text-orange-700",
  resolved: "bg-emerald-100 text-emerald-700",
  closed: "bg-surface-gray-2 text-ink-gray-6",
};

interface Issue {
  id: string; issue_no: string; subject: string; status: string; priority: string | null;
  issue_type: string | null; raised_by: string | null; opening_date: string; resolved_on: string | null;
  description: string | null; resolution_details: string | null;
  labs: { name: string } | null; devices: { asset_code: string } | null;
}

export default async function IssueDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("issues")
    .select("id, issue_no, subject, status, priority, issue_type, raised_by, opening_date, resolved_on, description, resolution_details, labs(name), devices(asset_code)")
    .eq("id", params.id)
    .single();
  const it = data as unknown as Issue | null;
  if (!it) notFound();

  const done = it.status === "resolved" || it.status === "closed";

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-gray-5">
        <Link href="/issues" className="hover:text-brand">← Support issues</Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8">{it.issue_no}</h1>
          <p className="text-sm text-ink-gray-5">{it.subject}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge[it.status] ?? "bg-surface-gray-2"}`}>
          {it.status.replace("_", " ")}
        </span>
      </div>

      <Panel title="Details">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 px-4 py-4 text-sm sm:grid-cols-3">
          <div><dt className="text-ink-gray-4">Lab</dt><dd className="text-ink-gray-8">{it.labs?.name ?? "—"}</dd></div>
          <div><dt className="text-ink-gray-4">Device</dt><dd className="text-ink-gray-8">{it.devices?.asset_code ?? "—"}</dd></div>
          <div><dt className="text-ink-gray-4">Priority</dt><dd className="text-ink-gray-8">{it.priority ?? "—"}</dd></div>
          <div><dt className="text-ink-gray-4">Type</dt><dd className="text-ink-gray-8">{it.issue_type ?? "—"}</dd></div>
          <div><dt className="text-ink-gray-4">Raised by</dt><dd className="text-ink-gray-8">{it.raised_by ?? "—"}</dd></div>
          <div><dt className="text-ink-gray-4">Opened</dt><dd className="text-ink-gray-8">{it.opening_date}</dd></div>
          {it.resolved_on && <div><dt className="text-ink-gray-4">Resolved</dt><dd className="text-ink-gray-8">{it.resolved_on}</dd></div>}
        </dl>
        {it.description && (
          <div className="border-t border-outline-gray-1 px-4 py-3 text-sm">
            <div className="text-xs uppercase text-ink-gray-4">Description</div>
            <p className="mt-1 whitespace-pre-wrap text-ink-gray-7">{it.description}</p>
          </div>
        )}
      </Panel>

      <Panel title="Resolution">
        {done && it.resolution_details ? (
          <p className="whitespace-pre-wrap px-4 py-4 text-sm text-ink-gray-7">{it.resolution_details}</p>
        ) : (
          <form action={resolveIssueForm} className="space-y-3 px-4 py-4">
            <input type="hidden" name="id" value={it.id} />
            <textarea
              name="resolution_details"
              rows={3}
              placeholder="How was it resolved?"
              className="w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              defaultValue={it.resolution_details ?? ""}
            />
            <button className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
              Mark resolved
            </button>
          </form>
        )}
      </Panel>
    </div>
  );
}
