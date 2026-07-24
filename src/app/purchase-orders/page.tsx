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
import {
  submitPurchaseOrderForm,
  poToPurchaseInvoiceForm,
  cancelPurchaseOrderForm,
  deletePurchaseOrderForm,
} from "@/app/actions/purchase_order";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  po_no: string;
  transaction_date: string;
  required_by: string | null;
  status: string;
  total_amount: number;
  companies: { name: string } | null;
  purchase_order_items: { id: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function PurchaseOrdersPage({
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
    .from("purchase_orders")
    .select("id, po_no, transaction_date, required_by, status, total_amount, companies:supplier_id(name), purchase_order_items(id)", { count: "exact" })
    .order("transaction_date", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("po_no", `%${q}%`);
  const { data, count } = await query;
  const rows = (data as unknown as Row[]) ?? [];
  const total = count ?? rows.length;

  // Stat cards span the whole table, not just this page.
  const { data: aggData } = await supabase.from("purchase_orders").select("status, total_amount");
  const agg = (aggData as unknown as { status: string; total_amount: number }[]) ?? [];
  const open = agg.filter((r) => r.status === "draft" || r.status === "submitted");
  const openValue = open.reduce((s, r) => s + Number(r.total_amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Open orders")} value={String(open.length)} accent="amber" />
        <StatCard label={t(locale, "Open value")} value={openValue.toLocaleString()} accent="brand" />
        <StatCard label={t(locale, "Total")} value={agg.length.toLocaleString()} accent="green" />
      </div>

      <ListShell
        title={t(locale, "Purchase Orders")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Buying") }]}
        count={total}
        filterable={false}
        newHref="/purchase-orders/new"
        newLabel={t(locale, "New order")}
        actions={<Link href="/purchases" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Purchases")}</Link>}
      >
        <ListSearch basePath="/purchase-orders" q={q} placeholder={t(locale, "PO no.")} />
        {rows.length === 0 ? (
          <EmptyRow text={q ? `${t(locale, "No matches for")} “${q}”` : t(locale, "No purchase orders yet — order kits/devices from a supplier")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "PO no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Supplier")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Items")}</th>
                  <th className="px-4 py-2">{t(locale, "Total")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2 font-medium">
                      <Link href={`/purchase-orders/${o.id}`} className="text-brand hover:underline">{o.po_no}</Link>
                    </td>
                    <td className="px-4 py-2">{o.companies?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.transaction_date}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.purchase_order_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(o.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[o.status] ?? "bg-surface-gray-2"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {o.status === "draft" && (
                          <>
                            <form action={submitPurchaseOrderForm}>
                              <input type="hidden" name="id" value={o.id} />
                              <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Submit")}</button>
                            </form>
                            <Link href={`/purchase-orders/${o.id}/edit`} className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:border-brand hover:text-brand">
                              <PencilIcon size={12} /> {t(locale, "Edit")}
                            </Link>
                            <form action={cancelPurchaseOrderForm}>
                              <input type="hidden" name="id" value={o.id} />
                              <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                            </form>
                          </>
                        )}
                        {o.status === "submitted" && (
                          <form action={poToPurchaseInvoiceForm} className="flex items-center gap-1">
                            <input type="hidden" name="id" value={o.id} />
                            <input name="reference" placeholder={t(locale, "supplier inv#")} className="w-28 rounded-md border border-outline-gray-2 px-2 py-1 text-xs" />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Bill")}</button>
                          </form>
                        )}
                        {(o.status === "draft" || o.status === "cancelled") && (
                          <form action={deletePurchaseOrderForm}>
                            <input type="hidden" name="id" value={o.id} />
                            <ConfirmSubmit
                              confirmText={t(locale, "Delete this order permanently? This cannot be undone.")}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              <Trash2Icon size={12} /> {t(locale, "Delete")}
                            </ConfirmSubmit>
                          </form>
                        )}
                        {o.status !== "draft" && o.status !== "submitted" && o.status !== "cancelled" && (
                          <span className="text-xs text-ink-gray-4">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/purchase-orders?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`} />
          </div>
        )}
      </ListShell>
    </div>
  );
}
