import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/dashboard/Panel";
import { FormShell } from "@/components/desk/FormShell";
import { Attachments } from "@/components/attachments/Attachments";
import { resolveIssueForm } from "@/app/actions/support";

export const dynamic = "force-dynamic";

interface Issue {
  id: string; issue_no: string; subject: string; status: string; priority: string | null;
  issue_type: string | null; raised_by: string | null; opening_date: string; resolved_on: string | null;
  description: string | null; resolution_details: string | null;
  labs: { name: string } | null; devices: { asset_code: string } | null;
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <dt className="text-ink-gray-4">{label}</dt>
      <dd className="text-right text-ink-gray-8">{value}</dd>
    </div>
  );
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
    <FormShell
      title={it.issue_no}
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Support", href: "/issues" }, { label: it.issue_no }]}
      status={it.status}
      sidebar={
        <dl className="space-y-0.5">
          <div className="mb-2 text-xs font-semibold uppercase text-ink-gray-4">Details</div>
          <MetaRow label="Lab" value={it.labs?.name ?? "—"} />
          <MetaRow label="Device" value={it.devices?.asset_code ?? "—"} />
          <MetaRow label="Priority" value={it.priority ?? "—"} />
          <MetaRow label="Type" value={it.issue_type ?? "—"} />
          <MetaRow label="Raised by" value={it.raised_by ?? "—"} />
          <MetaRow label="Opened" value={it.opening_date} />
          {it.resolved_on && <MetaRow label="Resolved" value={it.resolved_on} />}
        </dl>
      }
    >
      <div className="space-y-6">
        <Panel title={it.subject}>
          <div className="px-4 py-3 text-sm">
            {it.description ? (
              <p className="whitespace-pre-wrap text-ink-gray-7">{it.description}</p>
            ) : (
              <p className="text-ink-gray-4">No description.</p>
            )}
          </div>
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

        <Attachments entity="issue" recordId={params.id} path={`/issues/${params.id}`} />
      </div>
    </FormShell>
  );
}
