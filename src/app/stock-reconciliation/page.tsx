import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { postStockReconciliationForm } from "@/app/actions/stock";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  posting_date: string;
  status: string;
  notes: string | null;
  stock_reconciliation_items: { id: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  posted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function StockReconPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("stock_reconciliations")
    .select("id, posting_date, status, notes, stock_reconciliation_items(id)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Stock Reconciliation")}</h1>
        <div className="flex gap-2">
          <Link href="/kits" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">← Kits</Link>
          <Link href="/stock-reconciliation/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New count</Link>
        </div>
      </div>
      <Panel title={`${t(locale, "Counts")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No stock counts — reconcile kit batch quantities to a physical count")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Batches")}</th>
                  <th className="px-4 py-2">{t(locale, "Notes")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-ink-gray-5">{r.posting_date}</td>
                    <td className="px-4 py-2">{r.stock_reconciliation_items?.length ?? 0}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.notes ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? "bg-surface-gray-2"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {r.status === "draft" ? (
                        <form action={postStockReconciliationForm}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Post</button>
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
