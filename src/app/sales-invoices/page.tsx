import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  submitSalesInvoiceForm,
  cancelSalesInvoiceForm,
  recordInvoicePaymentForm,
} from "@/app/actions/sales_invoice";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  invoice_no: string;
  posting_date: string;
  due_date: string | null;
  status: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  labs: { name: string } | null;
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  unpaid: "bg-amber-100 text-amber-700",
  partly_paid: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function SalesInvoicesPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_invoices")
    .select("id, invoice_no, posting_date, due_date, status, total_amount, paid_amount, outstanding, labs(name)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const billed = rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Number(r.total_amount), 0);
  const outstanding = rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Number(r.outstanding), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">Sales Invoices</h1>
        <div className="flex gap-2">
          <Link href="/sales-orders" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Sales orders</Link>
          <Link href="/sales-invoices/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New invoice</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Billed" value={billed.toLocaleString()} accent="brand" />
        <StatCard label="Outstanding" value={outstanding.toLocaleString()} accent="amber" />
        <StatCard label="Invoices" value={String(rows.length)} accent="green" />
      </div>

      <Panel title={`Invoices (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No invoices yet — bill a lab for kits or devices" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Invoice no.</th>
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Total</th>
                  <th className="px-4 py-2">Outstanding</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/sales-invoices/${inv.id}`} className="text-brand hover:underline">{inv.invoice_no}</Link>
                    </td>
                    <td className="px-4 py-2">{inv.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{inv.posting_date}</td>
                    <td className="px-4 py-2">{Number(inv.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{Number(inv.outstanding).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[inv.status] ?? "bg-surface-gray-2"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {inv.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitSalesInvoiceForm}>
                            <input type="hidden" name="id" value={inv.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Submit</button>
                          </form>
                          <form action={cancelSalesInvoiceForm}>
                            <input type="hidden" name="id" value={inv.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">Cancel</button>
                          </form>
                        </div>
                      ) : inv.status === "unpaid" || inv.status === "partly_paid" ? (
                        <form action={recordInvoicePaymentForm} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={inv.id} />
                          <input name="amount" type="number" step="0.01" min="0" placeholder="amount" className="w-24 rounded-md border border-outline-gray-2 px-2 py-1 text-xs" />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Pay</button>
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
