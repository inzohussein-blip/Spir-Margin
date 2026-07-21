import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { completeWorkOrderForm, cancelWorkOrderForm } from "@/app/actions/manufacturing";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  wo_no: string;
  status: string;
  qty: number;
  produced_qty: number;
  planned_end: string | null;
  products: { name: string } | null;
  boms: { bom_no: string } | null;
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  in_process: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  stopped: "bg-orange-100 text-orange-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function WorkOrdersPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("work_orders")
    .select("id, wo_no, status, qty, produced_qty, planned_end, products(name), boms(bom_no)")
    .order("created_at", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const open = rows.filter((r) => r.status === "draft" || r.status === "in_process").length;
  const done = rows.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6">

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Open")} value={String(open)} accent="amber" />
        <StatCard label={t(locale, "Completed")} value={String(done)} accent="green" />
        <StatCard label={t(locale, "Total")} value={String(rows.length)} accent="brand" />
      </div>

      <ListShell
        title={t(locale, "Work Orders")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Manufacturing") }]}
        count={rows.length}
        newHref="/work-orders/new"
        newLabel={t(locale, "New work order")}
        actions={<Link href="/boms" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">BOMs</Link>}
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No work orders yet — assemble a kit from its BOM")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "WO no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Product")}</th>
                  <th className="px-4 py-2">{t(locale, "BOM")}</th>
                  <th className="px-4 py-2">{t(locale, "Qty")}</th>
                  <th className="px-4 py-2">{t(locale, "Produced")}</th>
                  <th className="px-4 py-2">{t(locale, "Planned end")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((w) => (
                  <tr key={w.id}>
                    <td className="px-4 py-2 font-medium">{w.wo_no}</td>
                    <td className="px-4 py-2">{w.products?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{w.boms?.bom_no ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{Number(w.qty)}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{Number(w.produced_qty)}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{w.planned_end ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[w.status] ?? "bg-surface-gray-2"}`}>
                        {w.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {w.status === "draft" || w.status === "in_process" ? (
                        <div className="flex gap-2">
                          <form action={completeWorkOrderForm}>
                            <input type="hidden" name="id" value={w.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Complete")}</button>
                          </form>
                          <form action={cancelWorkOrderForm}>
                            <input type="hidden" name="id" value={w.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                          </form>
                        </div>
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
