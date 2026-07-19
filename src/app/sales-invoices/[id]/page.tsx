import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { Attachments } from "@/components/attachments/Attachments";
import { getUsdIqdRate } from "@/app/actions/currency";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);
const iqd = (n: number, rate: number) =>
  rate > 0 ? `${new Intl.NumberFormat("en-US").format(Math.round(n * rate))} د.ع` : undefined;

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  unpaid: "bg-amber-100 text-amber-700",
  partly_paid: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

interface Item { id: string; qty: number; rate: number; amount: number; products: { name: string; item_code: string | null } | null; }
interface Payment { id: string; amount: number; paid_on: string; note: string | null; }
interface Invoice {
  id: string; invoice_no: string; posting_date: string; due_date: string | null;
  status: string; total_amount: number; paid_amount: number; outstanding: number;
  currency: string; notes: string | null;
  labs: { name: string; code: string | null } | null;
  sales_invoice_items: Item[];
  sales_invoice_payments: Payment[];
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_invoices")
    .select(
      "id, invoice_no, posting_date, due_date, status, total_amount, paid_amount, outstanding, currency, notes, labs(name, code), sales_invoice_items(id, qty, rate, amount, products(name, item_code)), sales_invoice_payments(id, amount, paid_on, note)"
    )
    .eq("id", params.id)
    .single();
  const inv = data as unknown as Invoice | null;
  if (!inv) notFound();

  const items = inv.sales_invoice_items ?? [];
  const payments = (inv.sales_invoice_payments ?? []).slice().sort((a, b) => a.paid_on.localeCompare(b.paid_on));
  const rate = await getUsdIqdRate();

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-gray-5">
        <Link href="/sales-invoices" className="hover:text-brand">← Sales invoices</Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8">{inv.invoice_no}</h1>
          <p className="text-sm text-ink-gray-5">
            {inv.labs?.name ?? "—"} · {inv.posting_date}
            {inv.due_date ? ` · due ${inv.due_date}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href={`/sales-invoices/${inv.id}/print`} className="inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">
            Print / PDF
          </Link>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge[inv.status] ?? "bg-surface-gray-2"}`}>
            {inv.status.replace("_", " ")}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={money(Number(inv.total_amount))} hint={iqd(Number(inv.total_amount), rate)} accent="brand" />
        <StatCard label="Paid" value={money(Number(inv.paid_amount))} hint={iqd(Number(inv.paid_amount), rate)} accent="green" />
        <StatCard label="Outstanding" value={money(Number(inv.outstanding))} hint={iqd(Number(inv.outstanding), rate)} accent="amber" />
      </div>

      <Panel title={`Line items (${items.length})`}>
        {items.length === 0 ? (
          <EmptyRow text="No line items" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Product</th>
                  <th className="px-4 py-2">Qty</th>
                  <th className="px-4 py-2">Rate</th>
                  <th className="px-4 py-2">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {items.map((it) => (
                  <tr key={it.id}>
                    <td className="px-4 py-2 font-medium">
                      {it.products?.name ?? "—"}
                      {it.products?.item_code ? <span className="text-ink-gray-4"> ({it.products.item_code})</span> : null}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{Number(it.qty)}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{money(Number(it.rate))}</td>
                    <td className="px-4 py-2">{money(Number(it.amount))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-outline-gray-2">
                  <td className="px-4 py-2 font-semibold" colSpan={3}>Total</td>
                  <td className="px-4 py-2 font-semibold">{money(Number(inv.total_amount))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`Payment history (${payments.length})`}>
        {payments.length === 0 ? (
          <EmptyRow text="No payments recorded yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">{p.paid_on}</td>
                    <td className="px-4 py-2 text-emerald-700">{money(Number(p.amount))}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{p.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Attachments entity="sales_invoice" recordId={inv.id} path={`/sales-invoices/${inv.id}`} />
    </div>
  );
}
