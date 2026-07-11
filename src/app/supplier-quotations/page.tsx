import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { convertSupplierQuotationForm } from "@/app/actions/supplier_quotation";

export const dynamic = "force-dynamic";

interface Row {
  id: string; transaction_date: string; valid_till: string | null; status: string;
  total_amount: number; companies: { name: string } | null; supplier_quotation_items: { id: string }[];
}
const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-blue-100 text-blue-700",
  ordered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

export default async function SupplierQuotationsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("supplier_quotations")
    .select("id, transaction_date, valid_till, status, total_amount, companies(name), supplier_quotation_items(id)")
    .order("transaction_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Supplier Quotations</h1>
        <div className="flex gap-2">
          <Link href="/purchases" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Purchases</Link>
          <Link href="/supplier-quotations/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New</Link>
        </div>
      </div>
      <Panel title={`Supplier Quotations (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No supplier quotations — record a supplier's offer, then convert to a purchase" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Supplier</th><th className="px-4 py-2">Date</th><th className="px-4 py-2">Valid till</th>
                  <th className="px-4 py-2">Items</th><th className="px-4 py-2">Total</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-2 font-medium">{q.companies?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.transaction_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.valid_till ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.supplier_quotation_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(q.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[q.status] ?? "bg-surface-gray-2"}`}>{q.status}</span></td>
                    <td className="px-4 py-2">
                      {q.status !== "ordered" ? (
                        <form action={convertSupplierQuotationForm}>
                          <input type="hidden" name="id" value={q.id} />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">→ Purchase</button>
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
