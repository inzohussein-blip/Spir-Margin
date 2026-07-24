import Link from "next/link";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { ListShell } from "@/components/desk/ListShell";
import { Pager, PAGE_SIZE, parsePage, pageRange } from "@/components/desk/Pager";
import { ListSearch } from "@/components/desk/ListSearch";
import { ConfirmSubmit } from "@/components/settings/ConfirmSubmit";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { convertQuotationForm, deleteQuotationForm } from "@/app/actions/quotation";

export const dynamic = "force-dynamic";

interface Row {
  id: string; transaction_date: string; valid_till: string | null; status: string;
  total_amount: number; labs: { name: string } | null; quotation_items: { id: string }[];
}
const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-blue-100 text-blue-700",
  ordered: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

export default async function QuotationsPage({
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
    .from("quotations")
    .select("id, transaction_date, valid_till, status, total_amount, labs(name), quotation_items(id)", { count: "exact" })
    .order("transaction_date", { ascending: false })
    .range(from, to);
  if (labIds) query = query.in("lab_id", labIds);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];
  const total = count ?? rows.length;
  return (
    <ListShell
      title={t(locale, "Quotations")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Selling") }]}
      count={total}
      filterable={false}
      newHref="/quotations/new"
      newLabel={t(locale, "New quotation")}
      actions={<Link href="/sales-orders" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Sales orders")}</Link>}
    >
        <ListSearch basePath="/quotations" q={q} placeholder={t(locale, "Lab")} />
        {rows.length === 0 ? (
          <EmptyRow text={q ? `${t(locale, "No matches for")} “${q}”` : t(locale, "No quotations — quote a lab, then convert to a sales order")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Lab")}</th><th className="px-4 py-2">{t(locale, "Date")}</th><th className="px-4 py-2">{t(locale, "Valid till")}</th>
                  <th className="px-4 py-2">{t(locale, "Items")}</th><th className="px-4 py-2">{t(locale, "Total")}</th><th className="px-4 py-2">{t(locale, "Status")}</th><th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((q) => (
                  <tr key={q.id}>
                    <td className="px-4 py-2 font-medium">{q.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.transaction_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.valid_till ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{q.quotation_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(q.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[q.status] ?? "bg-surface-gray-2"}`}>{q.status}</span></td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/quotations/${q.id}/print`} className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Print")}</Link>
                        {q.status !== "ordered" && (q.labs) ? (
                          <form action={convertQuotationForm}>
                            <input type="hidden" name="id" value={q.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "→ Sales order")}</button>
                          </form>
                        ) : null}
                        {q.status !== "ordered" ? (
                          <>
                            <Link href={`/quotations/${q.id}/edit`} className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:border-brand hover:text-brand">
                              <PencilIcon size={12} /> {t(locale, "Edit")}
                            </Link>
                            <form action={deleteQuotationForm}>
                              <input type="hidden" name="id" value={q.id} />
                              <ConfirmSubmit
                                confirmText={t(locale, "Delete this quotation? This cannot be undone.")}
                                className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                              >
                                <Trash2Icon size={12} /> {t(locale, "Delete")}
                              </ConfirmSubmit>
                            </form>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/quotations?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
          </div>
        )}
    </ListShell>
  );
}
