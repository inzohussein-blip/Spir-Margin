import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n || 0);

const statusBadge: Record<string, string> = {
  submitted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

interface Item {
  id: string; qty: number; sell_price: number; buy_price: number; amount: number;
  products: { name: string; item_code: string | null } | null;
}
interface Return {
  id: string; return_no: string; posting_date: string; status: string;
  reason: string | null; notes: string | null; total_amount: number;
  labs: { name: string; code: string | null } | null;
  sales_return_items: Item[];
}

export default async function SalesReturnDetailPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_returns")
    .select(
      "id, return_no, posting_date, status, reason, notes, total_amount, labs(name, code), sales_return_items(id, qty, sell_price, buy_price, amount, products(name, item_code))"
    )
    .eq("id", params.id)
    .single();
  const ret = data as unknown as Return | null;
  if (!ret) notFound();

  const items = ret.sales_return_items ?? [];
  const cost = items.reduce((s, it) => s + Number(it.qty) * Number(it.buy_price), 0);

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-gray-5">
        <Link href="/sales-returns" className="hover:text-brand">← {t(locale, "Sales Returns")}</Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8">{ret.return_no}</h1>
          <p className="text-sm text-ink-gray-5">
            {ret.labs?.name ?? "—"} · {ret.posting_date}
            {ret.reason ? ` · ${ret.reason}` : ""}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusBadge[ret.status] ?? "bg-surface-gray-2"}`}>
          {ret.status}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label={t(locale, "Credited (returns)")} value={money(Number(ret.total_amount))} accent="amber" />
        <StatCard label={t(locale, "Cost returned to stock")} value={money(cost)} accent="brand" />
      </div>

      <div className="rounded-md border border-outline-gray-1 bg-surface-gray-1/60 px-4 py-2 text-xs text-ink-gray-5">
        {t(locale, "Booking this return restocked the returned kits and posted a reversing journal entry (revenue and cost reversed).")}
      </div>

      <Panel title={`${t(locale, "Line items")} (${items.length})`}>
        {items.length === 0 ? (
          <EmptyRow text={t(locale, "No line items")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Product")}</th>
                  <th className="px-4 py-2">{t(locale, "Qty")}</th>
                  <th className="px-4 py-2">{t(locale, "Rate")}</th>
                  <th className="px-4 py-2">{t(locale, "Amount")}</th>
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
                    <td className="px-4 py-2 text-ink-gray-5">{money(Number(it.sell_price))}</td>
                    <td className="px-4 py-2">{money(Number(it.amount))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-outline-gray-2">
                  <td className="px-4 py-2 font-semibold" colSpan={3}>{t(locale, "Total")}</td>
                  <td className="px-4 py-2 font-semibold">{money(Number(ret.total_amount))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Panel>

      {ret.notes ? (
        <Panel title={t(locale, "Notes")}>
          <p className="px-4 py-3 text-sm text-ink-gray-6">{ret.notes}</p>
        </Panel>
      ) : null}
    </div>
  );
}
