import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { Indicator } from "@/components/desk/Indicator";
import { submitBlanketOrderForm, cancelBlanketOrderForm } from "@/app/actions/blanket_order";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  order_no: string;
  order_type: string;
  from_date: string;
  to_date: string;
  status: string;
  labs: { name: string } | null;
  companies: { name: string } | null;
  blanket_order_items: { id: string; qty: number; rate: number; ordered_qty: number }[];
}

export default async function BlanketOrdersPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("blanket_orders")
    .select("id, order_no, order_type, from_date, to_date, status, labs:lab_id(name), companies:supplier_id(name), blanket_order_items(id, qty, rate, ordered_qty)")
    .order("from_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const active = rows.filter((r) => r.status === "active");
  const agreedValue = (r: Row) => (r.blanket_order_items ?? []).reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Active")} value={String(active.length)} accent="green" />
        <StatCard label={t(locale, "Draft")} value={String(rows.filter((r) => r.status === "draft").length)} accent="amber" />
        <StatCard label={t(locale, "Total")} value={String(rows.length)} accent="brand" />
      </div>

      <ListShell
        title={t(locale, "Blanket Orders")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Selling") }]}
        count={rows.length}
        newHref="/blanket-orders/new"
        newLabel={t(locale, "New blanket order")}
        filterPlaceholder="Filter by order / party…"
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No blanket orders yet — set up a long-term agreed rate with a lab or supplier")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Order no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Type")}</th>
                  <th className="px-4 py-2">{t(locale, "Party")}</th>
                  <th className="px-4 py-2">{t(locale, "Valid")}</th>
                  <th className="px-4 py-2 text-right">{t(locale, "Value")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-gray-1">
                    <td className="px-4 py-2 font-medium">{r.order_no}</td>
                    <td className="px-4 py-2 capitalize text-ink-gray-5">{r.order_type}</td>
                    <td className="px-4 py-2">{(r.order_type === "purchasing" ? r.companies?.name : r.labs?.name) ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.from_date} → {r.to_date}</td>
                    <td className="px-4 py-2 text-right">{agreedValue(r).toLocaleString()}</td>
                    <td className="px-4 py-2"><Indicator status={r.status} /></td>
                    <td className="px-4 py-2">
                      {r.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitBlanketOrderForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Activate")}</button>
                          </form>
                          <form action={cancelBlanketOrderForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                          </form>
                        </div>
                      ) : r.status === "active" ? (
                        <form action={cancelBlanketOrderForm}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
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
