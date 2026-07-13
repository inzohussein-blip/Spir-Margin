import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  submitPurchaseOrderForm,
  poToPurchaseInvoiceForm,
  cancelPurchaseOrderForm,
} from "@/app/actions/purchase_order";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  po_no: string;
  transaction_date: string;
  required_by: string | null;
  status: string;
  total_amount: number;
  companies: { name: string } | null;
  purchase_order_items: { id: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function PurchaseOrdersPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, po_no, transaction_date, required_by, status, total_amount, companies:supplier_id(name), purchase_order_items(id)")
    .order("transaction_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const open = rows.filter((r) => r.status === "draft" || r.status === "submitted");
  const openValue = open.reduce((s, r) => s + Number(r.total_amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Purchase Orders</h1>
        <div className="flex gap-2">
          <Link href="/purchases" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Purchases</Link>
          <Link href="/purchase-orders/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New order</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open orders" value={String(open.length)} accent="amber" />
        <StatCard label="Open value" value={openValue.toLocaleString()} accent="brand" />
        <StatCard label="Total" value={String(rows.length)} accent="green" />
      </div>

      <Panel title={`Orders (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No purchase orders yet — order kits/devices from a supplier" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">PO no.</th>
                  <th className="px-4 py-2">Supplier</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Items</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/purchase-orders/${o.id}`} className="text-brand hover:underline">{o.po_no}</Link>
                    </td>
                    <td className="px-4 py-2">{o.companies?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.transaction_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.purchase_order_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(o.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[o.status] ?? "bg-surface-gray-2"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {o.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitPurchaseOrderForm}>
                            <input type="hidden" name="id" value={o.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Submit</button>
                          </form>
                          <form action={cancelPurchaseOrderForm}>
                            <input type="hidden" name="id" value={o.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">Cancel</button>
                          </form>
                        </div>
                      ) : o.status === "submitted" ? (
                        <form action={poToPurchaseInvoiceForm} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={o.id} />
                          <input name="reference" placeholder="supplier inv#" className="w-28 rounded-md border border-outline-gray-2 px-2 py-1 text-xs" />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Bill</button>
                        </form>
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
