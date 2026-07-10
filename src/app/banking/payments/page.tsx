import Link from "next/link";
import { getPaymentEntries } from "@/lib/banking";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

interface PE {
  id: string;
  naming_series: string | null;
  payment_type: string;
  party_name: string | null;
  paid_amount: number;
  received_amount: number;
  reference_no: string | null;
  posting_date: string;
  is_reconciled: boolean;
}

export default async function PaymentsPage() {
  const rows = (await getPaymentEntries()) as PE[];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Payment Entries</h1>
        <div className="flex gap-2">
          <Link href="/banking" className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">← Banking</Link>
          <Link href="/banking/payments/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New payment</Link>
        </div>
      </div>
      <Panel title={`All Payments (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text="No payment entries yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-400">
                  <th className="px-4 py-2">Ref</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Party</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Reconciled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">{p.naming_series ?? p.reference_no ?? "—"}</td>
                    <td className="px-4 py-2">{p.payment_type}</td>
                    <td className="px-4 py-2">{p.party_name ?? "—"}</td>
                    <td className="px-4 py-2">
                      {Number(p.received_amount || p.paid_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-slate-500">{p.posting_date}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.is_reconciled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {p.is_reconciled ? "yes" : "no"}
                      </span>
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
