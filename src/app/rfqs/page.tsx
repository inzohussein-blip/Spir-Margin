import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { submitRfqForm } from "@/app/actions/rfq";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  rfq_no: string;
  transaction_date: string;
  status: string;
  rfq_items: { id: string }[];
  rfq_suppliers: { id: string; quote_status: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-amber-100 text-amber-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function RfqsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("rfqs")
    .select("id, rfq_no, transaction_date, status, rfq_items(id), rfq_suppliers(id, quote_status)")
    .order("transaction_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Requests for Quotation")}</h1>
        <div className="flex gap-2">
          <Link href="/supplier-quotations" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Supplier quotes")}</Link>
          <Link href="/rfqs/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New RFQ</Link>
        </div>
      </div>

      <Panel title={`${t(locale, "RFQs")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No RFQs yet — ask several suppliers to quote the same items")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "No.")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Items")}</th>
                  <th className="px-4 py-2">{t(locale, "Suppliers")}</th>
                  <th className="px-4 py-2">{t(locale, "Received")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => {
                  const received = r.rfq_suppliers?.filter((s) => s.quote_status === "received").length ?? 0;
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/rfqs/${r.id}`} className="text-brand hover:underline">{r.rfq_no}</Link>
                      </td>
                      <td className="px-4 py-2 text-ink-gray-5">{r.transaction_date}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{r.rfq_items?.length ?? 0}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{r.rfq_suppliers?.length ?? 0}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{received}/{r.rfq_suppliers?.length ?? 0}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? "bg-surface-gray-2"}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-2">
                        {r.status === "draft" ? (
                          <form action={submitRfqForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Submit")}</button>
                          </form>
                        ) : (
                          <Link href={`/rfqs/${r.id}`} className="text-xs text-brand hover:underline">open</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
