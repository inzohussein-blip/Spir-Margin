import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { Pager, PAGE_SIZE, parsePage, pageRange } from "@/components/desk/Pager";
import { ListSearch } from "@/components/desk/ListSearch";
import { postJournalEntryForm } from "@/app/actions/journal";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string; posting_date: string; voucher_type: string; status: string;
  user_remark: string | null; total_debit: number; total_credit: number;
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  posted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function JournalEntriesPage({
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
    .from("journal_entries")
    .select("id, posting_date, voucher_type, status, user_remark, total_debit, total_credit", { count: "exact" })
    .order("posting_date", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("voucher_type", `%${q}%`);
  const { data, count } = await query;
  const rows = (data as Row[]) ?? [];
  const total = count ?? rows.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Journal Entries")}</h1>
        <div className="flex gap-2">
          <Link href="/accounts" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Chart of Accounts")}</Link>
          <Link href="/journal-entries/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New journal</Link>
        </div>
      </div>
      <Panel title={`${t(locale, "Entries")} (${total.toLocaleString()})`}>
        <ListSearch basePath="/journal-entries" q={q} placeholder={t(locale, "Type")} />
        {rows.length === 0 ? (
          <EmptyRow text={q ? `${t(locale, "No matches for")} “${q}”` : t(locale, "No journal entries — post balanced debits and credits")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Type")}</th>
                  <th className="px-4 py-2">{t(locale, "Remark")}</th>
                  <th className="px-4 py-2">{t(locale, "Debit")}</th>
                  <th className="px-4 py-2">{t(locale, "Credit")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((j) => (
                  <tr key={j.id}>
                    <td className="px-4 py-2 text-ink-gray-5"><Link href={`/journal-entries/${j.id}`} className="text-brand hover:underline">{j.posting_date}</Link></td>
                    <td className="px-4 py-2">{j.voucher_type}</td>
                    <td className="px-4 py-2 text-ink-gray-5 max-w-xs truncate">{j.user_remark ?? "—"}</td>
                    <td className="px-4 py-2">{Number(j.total_debit).toLocaleString()}</td>
                    <td className="px-4 py-2">{Number(j.total_credit).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[j.status] ?? "bg-surface-gray-2"}`}>{j.status}</span>
                    </td>
                    <td className="px-4 py-2">
                      {j.status === "draft" ? (
                        <form action={postJournalEntryForm}>
                          <input type="hidden" name="id" value={j.id} />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Post")}</button>
                        </form>
                      ) : (
                        <span className="text-xs text-ink-gray-4">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/journal-entries?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
          </div>
        )}
      </Panel>
    </div>
  );
}
