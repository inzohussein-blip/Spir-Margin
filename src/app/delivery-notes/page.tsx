import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { submitDeliveryNoteForm } from "@/app/actions/delivery";

export const dynamic = "force-dynamic";

interface Row {
  id: string; posting_date: string; status: string; notes: string | null;
  labs: { name: string } | null; delivery_note_items: { id: string }[];
}
const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function DeliveryNotesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("delivery_notes")
    .select("id, posting_date, status, notes, labs(name), delivery_note_items(id)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Delivery Notes</h1>
        <div className="flex gap-2">
          <Link href="/kits" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">← Kits</Link>
          <Link href="/delivery-notes/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New delivery</Link>
        </div>
      </div>
      <Panel title={`Deliveries (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No delivery notes — submitting one withdraws kit stock to the lab" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Lab</th><th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Items</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2 font-medium">{d.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{d.posting_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{d.delivery_note_items?.length ?? 0}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[d.status] ?? "bg-surface-gray-2"}`}>{d.status}</span></td>
                    <td className="px-4 py-2">
                      {d.status === "draft" ? (
                        <form action={submitDeliveryNoteForm}>
                          <input type="hidden" name="id" value={d.id} />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Submit</button>
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
