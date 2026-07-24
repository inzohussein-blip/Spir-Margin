import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { Pager, PAGE_SIZE, parsePage, pageRange } from "@/components/desk/Pager";
import { StatCard } from "@/components/dashboard/StatCard";
import { receivePurchaseForm, cancelPurchaseForm } from "@/app/actions/purchasing";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  reference_no: string | null;
  posting_date: string;
  due_date: string | null;
  status: string;
  total_amount: number;
  companies: { name: string } | null;
  purchase_items: { id: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  received: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const locale = getLocale();
  const supabase = createClient();
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page);
  const [{ data, count }, { data: summary }] = await Promise.all([
    supabase
      .from("purchase_invoices")
      .select("id, reference_no, posting_date, due_date, status, total_amount, companies(name), purchase_items(id)", { count: "exact" })
      .order("posting_date", { ascending: false })
      .range(from, to),
    supabase.from("v_purchase_summary").select("*").single(),
  ]);
  const rows = (data as unknown as Row[]) ?? [];
  const total = count ?? rows.length;
  const s = (summary as { total_received_cost: number; total_draft_cost: number; received_count: number; draft_count: number }) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Purchases")}</h1>
        <div className="flex gap-2">
          <Link href="/material-requests" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Material requests")}</Link>
          <Link href="/supplier-quotations" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Supplier quotes")}</Link>
          <Link href="/payment-terms" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Payment terms")}</Link>
          <Link href="/purchases/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            + New purchase
          </Link>
        </div>
      </div>

      {s && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t(locale, "Received cost")} value={Number(s.total_received_cost).toLocaleString()} hint={`${s.received_count} received`} accent="green" />
          <StatCard label={t(locale, "Draft cost")} value={Number(s.total_draft_cost).toLocaleString()} hint={`${s.draft_count} draft`} accent="amber" />
          <StatCard label={t(locale, "Purchases")} value={total.toLocaleString()} accent="brand" />
        </div>
      )}

      <Panel title={`${t(locale, "All Purchases")} (${total.toLocaleString()})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No purchases yet — record buying kits/devices from a supplier")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Ref")}</th>
                  <th className="px-4 py-2">{t(locale, "Supplier")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Due")}</th>
                  <th className="px-4 py-2">{t(locale, "Items")}</th>
                  <th className="px-4 py-2">{t(locale, "Total")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">{p.reference_no ?? "—"}</td>
                    <td className="px-4 py-2">{p.companies?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5"><Link href={`/purchases/${p.id}`} className="text-brand hover:underline">{p.posting_date}</Link></td>
                    <td className="px-4 py-2 text-ink-gray-5">{p.due_date ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{p.purchase_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(p.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[p.status] ?? "bg-surface-gray-2"}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {p.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={receivePurchaseForm}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Receive")}</button>
                          </form>
                          <form action={cancelPurchaseForm}>
                            <input type="hidden" name="id" value={p.id} />
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
            <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/purchases?page=${p}`} />
          </div>
        )}
      </Panel>
    </div>
  );
}
