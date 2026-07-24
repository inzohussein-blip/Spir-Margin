import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { submitStockEntryForm, cancelStockEntryForm } from "@/app/actions/stock_entry";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  entry_no: string;
  purpose: string;
  status: string;
  posting_date: string;
  from_wh: { name: string } | null;
  to_wh: { name: string } | null;
  stock_entry_items: { id: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};
const purposeBadge: Record<string, string> = {
  receipt: "bg-emerald-100 text-emerald-700",
  issue: "bg-amber-100 text-amber-700",
  transfer: "bg-blue-100 text-blue-700",
};

export default async function StockEntriesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("stock_entries")
    .select("id, entry_no, purpose, status, posting_date, from_wh:from_warehouse(name), to_wh:to_warehouse(name), stock_entry_items(id)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Stock Entries")}</h1>
        <div className="flex gap-2">
          <Link href="/stock-reconciliation" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Reconciliation")}</Link>
          <Link href="/stock-entries/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ {t(locale, "New entry")}</Link>
        </div>
      </div>

      <Panel title={`${t(locale, "Stock entries")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No stock entries yet — receive, issue, or transfer kit batches between warehouses")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Entry no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Purpose")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "From")}</th>
                  <th className="px-4 py-2">{t(locale, "To")}</th>
                  <th className="px-4 py-2">{t(locale, "Rows")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="px-4 py-2 font-medium"><Link href={`/stock-entries/${e.id}`} className="text-brand hover:underline">{e.entry_no}</Link></td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${purposeBadge[e.purpose] ?? "bg-surface-gray-2"}`}>
                        {e.purpose}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{e.posting_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{e.from_wh?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{e.to_wh?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{e.stock_entry_items?.length ?? 0}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[e.status] ?? "bg-surface-gray-2"}`}>
                        {e.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {e.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitStockEntryForm}>
                            <input type="hidden" name="id" value={e.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Submit")}</button>
                          </form>
                          <form action={cancelStockEntryForm}>
                            <input type="hidden" name="id" value={e.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
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
      </Panel>
    </div>
  );
}
