import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row { product_id: string; item_code: string | null; product_name: string; product_type: string; qty_sold: number; revenue: number; invoices: number; }

export default async function SalesByProductReport() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("v_sales_by_product").select("*").order("revenue", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const total = rows.reduce((s, r) => s + Number(r.revenue), 0);

  return (
    <ListShell
      title={t(locale, "Sales by Product")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Reports"), href: "/reports" }, { label: t(locale, "Sales by Product") }]}
      count={rows.length}
      filterPlaceholder="Filter by product…"
    >
      {rows.length === 0 ? <EmptyRow text={t(locale, "No sales yet")} /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">{t(locale, "Item code")}</th><th className="px-4 py-2">{t(locale, "Product")}</th><th className="px-4 py-2">{t(locale, "Type")}</th>
              <th className="px-4 py-2 text-right">{t(locale, "Qty sold")}</th><th className="px-4 py-2 text-right">{t(locale, "Invoices")}</th><th className="px-4 py-2 text-right">{t(locale, "Revenue")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-gray-1">
            {rows.map((r) => (
              <tr key={r.product_id} className="hover:bg-surface-gray-1">
                <td className="px-4 py-2 font-medium">{r.item_code ?? "—"}</td>
                <td className="px-4 py-2">{r.product_name}</td>
                <td className="px-4 py-2 capitalize text-ink-gray-5">{r.product_type?.replace(/_/g, " ")}</td>
                <td className="px-4 py-2 text-right">{Number(r.qty_sold)}</td>
                <td className="px-4 py-2 text-right text-ink-gray-5">{Number(r.invoices)}</td>
                <td className="px-4 py-2 text-right font-medium">{money(Number(r.revenue))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t border-outline-gray-2 font-semibold"><td className="px-4 py-2" colSpan={5}>{t(locale, "Total revenue")}</td><td className="px-4 py-2 text-right">{money(total)}</td></tr></tfoot>
        </table>
      )}
    </ListShell>
  );
}
