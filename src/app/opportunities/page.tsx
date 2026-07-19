import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { setOpportunityStatusForm } from "@/app/actions/opportunity";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  title: string;
  status: string;
  sales_stage: string | null;
  opportunity_amount: number;
  probability: number;
  expected_closing: string | null;
  labs: { name: string } | null;
}

const statusBadge: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  quotation: "bg-amber-100 text-amber-700",
  converted: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
  closed: "bg-surface-gray-2 text-ink-gray-6",
};

export default async function OpportunitiesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const [{ data }, { data: summary }] = await Promise.all([
    supabase
      .from("opportunities")
      .select("id, title, status, sales_stage, opportunity_amount, probability, expected_closing, labs(name)")
      .order("created_at", { ascending: false }),
    supabase.from("v_pipeline_summary").select("*").single(),
  ]);
  const rows = (data as unknown as Row[]) ?? [];
  const s = summary as { open_amount: number; weighted_amount: number; open_count: number; won_count: number } | null;

  return (
    <div className="space-y-6">

      {s && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label={t(locale, "Open pipeline")} value={Number(s.open_amount).toLocaleString()} hint={`${s.open_count} open`} accent="brand" />
          <StatCard label={t(locale, "Weighted value")} value={Number(s.weighted_amount).toLocaleString()} hint="amount × probability" accent="amber" />
          <StatCard label={t(locale, "Won")} value={String(s.won_count)} accent="green" />
        </div>
      )}

      <ListShell
        title={t(locale, "Opportunities")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "CRM") }]}
        count={rows.length}
        newHref="/opportunities/new"
        newLabel={t(locale, "New opportunity")}
        actions={<Link href="/sales-team" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Sales team</Link>}
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No opportunities yet")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Title")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Stage")}</th>
                  <th className="px-4 py-2">{t(locale, "Amount")}</th>
                  <th className="px-4 py-2">{t(locale, "Prob.")}</th>
                  <th className="px-4 py-2">{t(locale, "Closing")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2 font-medium">{o.title}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.sales_stage ?? "—"}</td>
                    <td className="px-4 py-2">{Number(o.opportunity_amount).toLocaleString()}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{Number(o.probability)}%</td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.expected_closing ?? "—"}</td>
                    <td className="px-4 py-2">
                      <form action={setOpportunityStatusForm} className="flex items-center gap-2">
                        <input type="hidden" name="id" value={o.id} />
                        <select name="status" defaultValue={o.status} className="rounded-md border border-outline-gray-2 px-2 py-1 text-xs">
                          <option value="open">open</option>
                          <option value="quotation">quotation</option>
                          <option value="converted">converted</option>
                          <option value="lost">lost</option>
                          <option value="closed">closed</option>
                        </select>
                        <button className="rounded-md bg-brand px-2 py-1 text-xs font-medium text-white hover:bg-brand-dark">Set</button>
                      </form>
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
