import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { Pager, PAGE_SIZE, parsePage, pageRange } from "@/components/desk/Pager";
import { ListSearch } from "@/components/desk/ListSearch";
import { submitDeliveryNoteForm } from "@/app/actions/delivery";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string; posting_date: string; status: string; notes: string | null;
  labs: { name: string } | null; delivery_note_items: { id: string }[];
}
const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function DeliveryNotesPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const locale = getLocale();
  const supabase = createClient();
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page);
  const q = (searchParams?.q ?? "").trim();

  let labIds: string[] | null = null;
  if (q) {
    const { data: labs } = await supabase.from("labs").select("id").ilike("name", `%${q}%`);
    labIds = ((labs as { id: string }[]) ?? []).map((l) => l.id);
  }

  let query = supabase
    .from("delivery_notes")
    .select("id, posting_date, status, notes, labs(name), delivery_note_items(id)", { count: "exact" })
    .order("posting_date", { ascending: false })
    .range(from, to);
  if (labIds) query = query.in("lab_id", labIds);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];
  const total = count ?? rows.length;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Delivery Notes")}</h1>
        <div className="flex gap-2">
          <Link href="/kits" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">← {t(locale, "Kits")}</Link>
          <Link href="/delivery-notes/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ {t(locale, "New delivery")}</Link>
        </div>
      </div>
      <Panel title={`${t(locale, "Deliveries")} (${total.toLocaleString()})`}>
        <ListSearch basePath="/delivery-notes" q={q} placeholder={t(locale, "Lab")} />
        {rows.length === 0 ? (
          <EmptyRow text={q ? `${t(locale, "No matches for")} “${q}”` : t(locale, "No delivery notes — submitting one withdraws kit stock to the lab")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Lab")}</th><th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Items")}</th><th className="px-4 py-2">{t(locale, "Status")}</th><th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2 font-medium">{d.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5"><Link href={`/delivery-notes/${d.id}`} className="text-brand hover:underline">{d.posting_date}</Link></td>
                    <td className="px-4 py-2 text-ink-gray-5">{d.delivery_note_items?.length ?? 0}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[d.status] ?? "bg-surface-gray-2"}`}>{d.status}</span></td>
                    <td className="px-4 py-2">
                      {d.status === "draft" ? (
                        <form action={submitDeliveryNoteForm}>
                          <input type="hidden" name="id" value={d.id} />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Submit")}</button>
                        </form>
                      ) : <span className="text-xs text-ink-gray-4">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/delivery-notes?page=${p}`} />
          </div>
        )}
      </Panel>
    </div>
  );
}
