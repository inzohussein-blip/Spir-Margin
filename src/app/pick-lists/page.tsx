import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { Indicator } from "@/components/desk/Indicator";
import { openPickListForm, completePickListForm, cancelPickListForm } from "@/app/actions/pick_list";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  pick_no: string;
  purpose: string;
  posting_date: string;
  status: string;
  labs: { name: string } | null;
  pick_list_items: { id: string; qty: number; picked_qty: number }[];
}

export default async function PickListsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("pick_lists")
    .select("id, pick_no, purpose, posting_date, status, labs:lab_id(name), pick_list_items(id, qty, picked_qty)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const open = rows.filter((r) => r.status === "open");
  const draft = rows.filter((r) => r.status === "draft");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Draft" value={String(draft.length)} accent="amber" />
        <StatCard label="Open (on floor)" value={String(open.length)} accent="brand" />
        <StatCard label="Total" value={String(rows.length)} accent="green" />
      </div>

      <ListShell
        title="Pick Lists"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Stock" }]}
        count={rows.length}
        newHref="/pick-lists/new"
        newLabel="New pick list"
        actions={<Link href="/delivery-notes" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Delivery notes</Link>}
        filterPlaceholder="Filter by pick / lab…"
      >
        {rows.length === 0 ? (
          <EmptyRow text="No pick lists yet — create a picking sheet before a delivery" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Pick no.</th>
                  <th className="px-4 py-2">Purpose</th>
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2 text-right">Lines</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-gray-1">
                    <td className="px-4 py-2 font-medium">{r.pick_no}</td>
                    <td className="px-4 py-2 capitalize text-ink-gray-5">{r.purpose.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2">{r.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.posting_date}</td>
                    <td className="px-4 py-2 text-right text-ink-gray-5">{r.pick_list_items?.length ?? 0}</td>
                    <td className="px-4 py-2"><Indicator status={r.status} /></td>
                    <td className="px-4 py-2">
                      {r.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={openPickListForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Open</button>
                          </form>
                          <form action={cancelPickListForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">Cancel</button>
                          </form>
                        </div>
                      ) : r.status === "open" ? (
                        <div className="flex gap-2">
                          <form action={completePickListForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Complete</button>
                          </form>
                          <form action={cancelPickListForm}>
                            <input type="hidden" name="id" value={r.id} />
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
      </ListShell>
    </div>
  );
}
