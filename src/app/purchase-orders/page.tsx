import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import {
  submitPurchaseOrderForm,
  poToPurchaseInvoiceForm,
  cancelPurchaseOrderForm,
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

export default async function PurchaseOrdersPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("purchase_orders")
    .select("id, po_no, transaction_date, required_by, status, total_amount, companies:supplier_id(name), purchase_order_items(id)")
    .order("transaction_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const open = rows.filter((r) => r.status === "draft" || r.status === "submitted");
  const openValue = open.reduce((s, r) => s + Number(r.total_amount), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Open orders")} value={String(open.length)} accent="amber" />
        <StatCard label={t(locale, "Open value")} value={openValue.toLocaleString()} accent="brand" />
        <StatCard label={t(locale, "Total")} value={String(rows.length)} accent="green" />
      </div>

      <ListShell
        title={t(locale, "Purchase Orders")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Buying") }]}
        count={rows.length}
        newHref="/purchase-orders/new"
        newLabel={t(locale, "New order")}
        actions={<Link href="/purchases" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Purchases")}</Link>}
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No purchase orders yet — order kits/devices from a supplier")} />
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
                      {o.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitPurchaseOrderForm}>
                            <input type="hidden" name="id" value={o.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Submit")}</button>
                          </form>
                          <form action={cancelPurchaseOrderForm}>
                            <input type="hidden" name="id" value={o.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                          </form>
                        </div>
                      ) : o.status === "submitted" ? (
                        <form action={poToPurchaseInvoiceForm} className="flex items-center gap-1">
                          <input type="hidden" name="id" value={o.id} />
                          <input name="reference" placeholder={t(locale, "supplier inv#")} className="w-28 rounded-md border border-outline-gray-2 px-2 py-1 text-xs" />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Bill")}</button>
                        </form>
                      ) : (
                        <span className="text-xs text-ink-gray-4">—</span>
                      )}
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
