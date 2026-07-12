import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { submitInstallationNoteForm, cancelInstallationNoteForm } from "@/app/actions/installation";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  inst_no: string;
  inst_date: string;
  status: string;
  remarks: string | null;
  labs: { name: string } | null;
  installation_note_items: { id: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function InstallationNotesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("installation_notes")
    .select("id, inst_no, inst_date, status, remarks, labs(name), installation_note_items(id)")
    .order("inst_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Installation Notes</h1>
        <div className="flex gap-2">
          <Link href="/devices" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Devices</Link>
          <Link href="/installation-notes/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New note</Link>
        </div>
      </div>

      <Panel title={`Notes (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No installation notes yet — record installing devices at a lab" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Note no.</th>
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Devices</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((n) => (
                  <tr key={n.id}>
                    <td className="px-4 py-2 font-medium">{n.inst_no}</td>
                    <td className="px-4 py-2">{n.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{n.inst_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{n.installation_note_items?.length ?? 0}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[n.status] ?? "bg-surface-gray-2"}`}>
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {n.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitInstallationNoteForm}>
                            <input type="hidden" name="id" value={n.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Submit</button>
                          </form>
                          <form action={cancelInstallationNoteForm}>
                            <input type="hidden" name="id" value={n.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">Cancel</button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-gray-4">—</span>
                      )}
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
