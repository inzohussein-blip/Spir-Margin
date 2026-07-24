import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { Pager, PAGE_SIZE, parsePage, pageRange } from "@/components/desk/Pager";
import { ListSearch } from "@/components/desk/ListSearch";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string; return_no: string; posting_date: string; status: string;
  reason: string | null; total_amount: number; labs: { name: string } | null;
  sales_return_items: { id: string }[];
}

const statusBadge: Record<string, string> = {
  submitted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function SalesReturnsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const locale = getLocale();
  const supabase = createClient();
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page);
  const q = (searchParams?.q ?? "").trim();

  let query = supabase
    .from("sales_returns")
    .select("id, return_no, posting_date, status, reason, total_amount, labs(name), sales_return_items(id)", { count: "exact" })
    .order("posting_date", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("return_no", `%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];
  const total = count ?? rows.length;

  // Whole-table figures for the cards (credited value = returned amount).
  const { data: aggData } = await supabase.from("sales_returns").select("status, total_amount");
  const agg = (aggData as unknown as { status: string; total_amount: number }[]) ?? [];
  const credited = agg.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Number(r.total_amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatCard label={t(locale, "Credited (returns)")} value={credited.toLocaleString()} accent="amber" />
        <StatCard label={t(locale, "Returns")} value={agg.length.toLocaleString()} accent="brand" />
      </div>

      <ListShell
        title={t(locale, "Sales Returns")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Selling") }]}
        count={total}
        filterable={false}
        newHref="/sales-returns/new"
        newLabel={t(locale, "New return")}
        actions={<Link href="/sales-invoices" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Sales Invoices")}</Link>}
      >
        <ListSearch basePath="/sales-returns" q={q} placeholder={t(locale, "Return no.")} />
        {rows.length === 0 ? (
          <EmptyRow text={q ? `${t(locale, "No matches for")} “${q}”` : t(locale, "No returns yet — a return restocks kits and reverses the revenue")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Return no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Reason")}</th>
                  <th className="px-4 py-2">{t(locale, "Items")}</th>
                  <th className="px-4 py-2">{t(locale, "Total")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium">{r.return_no}</td>
                    <td className="px-4 py-2">{r.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.posting_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.reason ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.sales_return_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(r.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[r.status] ?? "bg-surface-gray-2"}`}>{r.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/sales-returns?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
          </div>
        )}
      </ListShell>
    </div>
  );
}
