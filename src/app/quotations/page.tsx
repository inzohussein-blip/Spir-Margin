import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { ListShell } from "@/components/desk/ListShell";
import { convertQuotationForm } from "@/app/actions/quotation";

export const dynamic = "force-dynamic";

interface Row {
  id: string; transaction_date: string; valid_till: string | null; status: string;
  total_amount: number; labs: { name: string } | null; quotation_items: { id: string }[];
}
const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-blue-100 text-blue-700",
  ordered: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

export default async function QuotationsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("quotations")
    .select("id, transaction_date, valid_till, status, total_amount, labs(name), quotation_items(id)")
    .order("transaction_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  return (
    <ListShell
      title="Quotations"
      breadcrumbs={[{ label: "Home", href: "/" }, { label: "Selling" }]}
      count={rows.length}
      newHref="/quotations/new"
      newLabel="New quotation"
      actions={<Link href="/sales-orders" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Sales orders</Link>}
    >
        {rows.length === 0 ? (
          <EmptyRow text="No quotations — quote a lab, then convert to a sales order" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Lab</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Valid till</th>
                  <th className="px-4 py-2">Items</th><th className="px-4 py-2">Total</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-2 font-medium">{q.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.transaction_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.valid_till ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.quotation_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(q.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[q.status] ?? "bg-surface-gray-2"}`}>{q.status}</span></td>
                    <td className="px-4 py-2">
                      {q.status !== "ordered" && (q.labs) ? (
                        <form action={convertQuotationForm}>
                          <input type="hidden" name="id" value={q.id} />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">→ Sales order</button>
                        </form>
                      ) : <span className="text-xs text-ink-gray-4">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </ListShell>
  );
}
