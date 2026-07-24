import Link from "next/link";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { Pager, PAGE_SIZE, parsePage, pageRange } from "@/components/desk/Pager";
import { ListSearch } from "@/components/desk/ListSearch";
import { ConfirmSubmit } from "@/components/settings/ConfirmSubmit";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { getUsdIqdRate } from "@/app/actions/currency";
import {
  submitSalesInvoiceForm,
  cancelSalesInvoiceForm,
  recordInvoicePaymentForm,
  deleteSalesInvoiceForm,
} from "@/app/actions/sales_invoice";

/** IQD equivalent for a USD amount, using the live daily rate (blank if unset). */
const iqd = (n: number, rate: number) =>
  rate > 0 ? `${new Intl.NumberFormat("en-US").format(Math.round(n * rate))} د.ع` : undefined;

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  invoice_no: string;
  posting_date: string;
  due_date: string | null;
  status: string;
  total_amount: number;
  paid_amount: number;
  outstanding: number;
  labs: { name: string } | null;
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  unpaid: "bg-amber-100 text-amber-700",
  partly_paid: "bg-blue-100 text-blue-700",
  paid: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function SalesInvoicesPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string };
}) {
  const locale = getLocale();
  const supabase = createClient();
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page);
  const q = (searchParams?.q ?? "").trim();

  // One page of rows for the table (bounded), plus the true total for the pager.
  // A search filters by invoice number across the whole table, server-side.
  let query = supabase
    .from("sales_invoices")
    .select("id, invoice_no, posting_date, due_date, status, total_amount, paid_amount, outstanding, labs(name)", { count: "exact" })
    .order("posting_date", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("invoice_no", `%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];
  const total = count ?? rows.length;

  // Totals must reflect the whole ledger, not just this page — fetch a light
  // aggregate (numeric columns only, no embed).
  const { data: aggData } = await supabase
    .from("sales_invoices")
    .select("status, total_amount, outstanding");
  const agg = (aggData as unknown as { status: string; total_amount: number; outstanding: number }[]) ?? [];
  const billed = agg.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Number(r.total_amount), 0);
  const outstanding = agg.filter((r) => r.status !== "cancelled").reduce((s, r) => s + Number(r.outstanding), 0);
  const rate = await getUsdIqdRate();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Billed")} value={billed.toLocaleString()} hint={iqd(billed, rate)} accent="brand" />
        <StatCard label={t(locale, "Outstanding")} value={outstanding.toLocaleString()} hint={iqd(outstanding, rate)} accent="amber" />
        <StatCard label={t(locale, "Invoices")} value={agg.length.toLocaleString()} accent="green" />
      </div>

      <ListShell
        title={t(locale, "Sales Invoices")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Accounting") }]}
        count={total}
        filterable={false}
        newHref="/sales-invoices/new"
        newLabel={t(locale, "New invoice")}
        actions={<>
          <a href="/sales-invoices/export" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Export CSV")}</a>
          <Link href="/sales-orders" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Sales orders")}</Link>
        </>}
      >
        <ListSearch basePath="/sales-invoices" q={q} placeholder={t(locale, "Invoice no.")} />
        {rows.length === 0 ? (
          <EmptyRow text={q ? `${t(locale, "No matches for")} “${q}”` : t(locale, "No invoices yet — bill a lab for kits or devices")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Invoice no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Total")}</th>
                  <th className="px-4 py-2">{t(locale, "Outstanding")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/sales-invoices/${inv.id}`} className="text-brand hover:underline">{inv.invoice_no}</Link>
                    </td>
                    <td className="px-4 py-2">{inv.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{inv.posting_date}</td>
                    <td className="px-4 py-2">{Number(inv.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{Number(inv.outstanding).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[inv.status] ?? "bg-surface-gray-2"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {inv.status === "draft" ? (
                        <div className="flex flex-wrap gap-2">
                          <form action={submitSalesInvoiceForm}>
                            <input type="hidden" name="id" value={inv.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Submit")}</button>
                          </form>
                          <Link href={`/sales-invoices/${inv.id}/edit`} className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:border-brand hover:text-brand">
                            <PencilIcon size={12} /> {t(locale, "Edit")}
                          </Link>
                          <form action={cancelSalesInvoiceForm}>
                            <input type="hidden" name="id" value={inv.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                          </form>
                          <form action={deleteSalesInvoiceForm}>
                            <input type="hidden" name="id" value={inv.id} />
                            <ConfirmSubmit
                              confirmText={t(locale, "Delete this draft invoice? This cannot be undone.")}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              <Trash2Icon size={12} /> {t(locale, "Delete")}
                            </ConfirmSubmit>
                          </form>
                        </div>
                      ) : inv.status === "unpaid" || inv.status === "partly_paid" ? (
                        <form action={recordInvoicePaymentForm} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={inv.id} />
                          <input name="amount" type="number" step="0.01" min="0" placeholder={t(locale, "amount")} className="w-24 rounded-md border border-outline-gray-2 px-2 py-1 text-xs" />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Pay")}</button>
                        </form>
                      ) : (
                        <span className="text-xs text-ink-gray-4">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              hrefFor={(p) => `/sales-invoices?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            />
          </div>
        )}
      </ListShell>
    </div>
  );
}
