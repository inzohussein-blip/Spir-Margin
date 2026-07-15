import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { Indicator } from "@/components/desk/Indicator";
import {
  submitPaymentRequestForm,
  payPaymentRequestForm,
  cancelPaymentRequestForm,
} from "@/app/actions/payment_request";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  request_no: string;
  posting_date: string;
  amount: number;
  status: string;
  sales_invoices: { invoice_no: string } | null;
  labs: { name: string } | null;
}

export default async function PaymentRequestsPage() {
  const supabase = createClient();
  const { data } = await supabase
    .from("payment_requests")
    .select("id, request_no, posting_date, amount, status, sales_invoices:invoice_id(invoice_no), labs:lab_id(name)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const outstanding = rows.filter((r) => r.status === "draft" || r.status === "requested");
  const requestedValue = outstanding.reduce((s, r) => s + Number(r.amount), 0);
  const collected = rows.filter((r) => r.status === "paid").reduce((s, r) => s + Number(r.amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open requests" value={String(outstanding.length)} accent="amber" />
        <StatCard label="Requested value" value={requestedValue.toLocaleString()} accent="brand" />
        <StatCard label="Collected" value={collected.toLocaleString()} accent="green" />
      </div>

      <ListShell
        title="Payment Requests"
        breadcrumbs={[{ label: "Home", href: "/" }, { label: "Accounting" }]}
        count={rows.length}
        newHref="/payment-requests/new"
        newLabel="New request"
        actions={<Link href="/sales-invoices" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Sales invoices</Link>}
        filterPlaceholder="Filter by request / invoice / lab…"
      >
        {rows.length === 0 ? (
          <EmptyRow text="No payment requests yet — request payment against an unpaid invoice" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Request no.</th>
                  <th className="px-4 py-2">Invoice</th>
                  <th className="px-4 py-2">Lab</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-gray-1">
                    <td className="px-4 py-2 font-medium">{r.request_no}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.sales_invoices?.invoice_no ?? "—"}</td>
                    <td className="px-4 py-2">{r.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.posting_date}</td>
                    <td className="px-4 py-2 text-right">{Number(r.amount).toLocaleString()}</td>
                    <td className="px-4 py-2"><Indicator status={r.status} /></td>
                    <td className="px-4 py-2">
                      {r.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitPaymentRequestForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Send</button>
                          </form>
                          <form action={cancelPaymentRequestForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">Cancel</button>
                          </form>
                        </div>
                      ) : r.status === "requested" ? (
                        <div className="flex gap-2">
                          <form action={payPaymentRequestForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Mark paid</button>
                          </form>
                          <form action={cancelPaymentRequestForm}>
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
