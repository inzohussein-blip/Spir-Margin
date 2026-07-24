import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { PencilIcon, Trash2Icon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { EmptyRow } from "@/components/dashboard/Panel";
import { ListShell } from "@/components/desk/ListShell";
import { Pager, PAGE_SIZE, parsePage, pageRange } from "@/components/desk/Pager";
import { ConfirmSubmit } from "@/components/settings/ConfirmSubmit";
import { deliverSalesOrderForm, cancelSalesOrderForm, deleteSalesOrderForm } from "@/app/actions/selling";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  transaction_date: string;
  delivery_date: string | null;
  status: string;
  total_amount: number;
  labs: { name: string } | null;
  sales_order_items: { id: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  confirmed: "bg-blue-100 text-blue-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function SalesOrdersPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const locale = getLocale();
  const supabase = createClient();
  const page = parsePage(searchParams?.page);
  const [from, to] = pageRange(page);
  const { data, count } = await supabase
    .from("sales_orders")
    .select("id, transaction_date, delivery_date, status, total_amount, labs(name), sales_order_items(id)", { count: "exact" })
    .order("transaction_date", { ascending: false })
    .range(from, to);
  const rows = (data as unknown as Row[]) ?? [];
  const total = count ?? rows.length;

  return (
    <ListShell
      title={t(locale, "Sales Orders")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Selling") }]}
      count={total}
      newHref="/sales-orders/new"
      newLabel={t(locale, "New order")}
    >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No sales orders — orders become sales when delivered")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Order date")}</th>
                  <th className="px-4 py-2">{t(locale, "Delivery")}</th>
                  <th className="px-4 py-2">{t(locale, "Items")}</th>
                  <th className="px-4 py-2">{t(locale, "Total")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-2 font-medium">{o.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5"><Link href={`/sales-orders/${o.id}`} className="text-brand hover:underline">{o.transaction_date}</Link></td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.delivery_date ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.sales_order_items?.length ?? 0}</td>
                    <td className="px-4 py-2">{Number(o.total_amount).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[o.status] ?? "bg-surface-gray-2"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-wrap gap-2">
                        {(o.status === "draft" || o.status === "confirmed") && (
                          <form action={deliverSalesOrderForm}>
                            <input type="hidden" name="id" value={o.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Deliver")}</button>
                          </form>
                        )}
                        {o.status === "draft" && (
                          <>
                            <Link href={`/sales-orders/${o.id}/edit`} className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:border-brand hover:text-brand">
                              <PencilIcon size={12} /> {t(locale, "Edit")}
                            </Link>
                            <form action={cancelSalesOrderForm}>
                              <input type="hidden" name="id" value={o.id} />
                              <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                            </form>
                          </>
                        )}
                        {(o.status === "draft" || o.status === "cancelled") && (
                          <form action={deleteSalesOrderForm}>
                            <input type="hidden" name="id" value={o.id} />
                            <ConfirmSubmit
                              confirmText={t(locale, "Delete this order permanently? This cannot be undone.")}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                            >
                              <Trash2Icon size={12} /> {t(locale, "Delete")}
                            </ConfirmSubmit>
                          </form>
                        )}
                        {o.status !== "draft" && o.status !== "confirmed" && o.status !== "cancelled" && (
                          <span className="text-xs text-ink-gray-4">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={page} pageSize={PAGE_SIZE} total={total} hrefFor={(p) => `/sales-orders?page=${p}`} />
          </div>
        )}
    </ListShell>
  );
}
