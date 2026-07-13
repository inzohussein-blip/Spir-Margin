import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

interface Item { id: string; qty: number; rate: number; amount: number; products: { name: string; item_code: string | null } | null; }
interface PurchaseInvoice { id: string; reference_no: string | null; status: string; total_amount: number; }
interface Po {
  id: string; po_no: string; transaction_date: string; required_by: string | null;
  status: string; total_amount: number; currency: string; notes: string | null;
  companies: { name: string } | null;
  purchase_order_items: Item[];
  purchase_invoices: PurchaseInvoice | null;
}

export default async function PoDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select(
      "id, po_no, transaction_date, required_by, status, total_amount, currency, notes, companies:supplier_id(name), purchase_order_items(id, qty, rate, amount, products(name, item_code)), purchase_invoices:purchase_id(id, reference_no, status, total_amount)"
    )
    .eq("id", params.id)
    .single();
  const po = data as unknown as Po | null;
  if (!po) notFound();

  const items = po.purchase_order_items ?? [];

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-gray-5">
        <Link href="/purchase-orders" className="hover:text-brand">← Purchase orders</Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8">{po.po_no}</h1>
          <p className="text-sm text-ink-gray-5">
            {po.companies?.name ?? "—"} · {po.transaction_date}
            {po.required_by ? ` · required by ${po.required_by}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge[po.status] ?? "bg-surface-gray-2"}`}>
          {po.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total" value={money(Number(po.total_amount))} accent="brand" />
        <StatCard label="Line items" value={String(items.length)} accent="green" />
        <StatCard
          label="Billed"
          value={po.purchase_invoices ? "Yes" : "No"}
          hint={po.purchase_invoices?.reference_no ?? undefined}
          accent="amber"
        />
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
                  <td className="px-4 py-2 font-semibold">{money(Number(po.total_amount))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      {po.purchase_invoices ? (
        <Panel title="Billed to purchase invoice">
          <div className="px-4 py-3 text-sm">
            <Link href="/purchases" className="font-medium text-brand hover:underline">
              {po.purchase_invoices.reference_no ?? "Purchase invoice"}
            </Link>
            <span className="text-ink-gray-5"> · {po.purchase_invoices.status} · {money(Number(po.purchase_invoices.total_amount))}</span>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
