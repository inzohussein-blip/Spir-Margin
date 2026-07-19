import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row { supplier_id: string | null; supplier_name: string; invoices: number; total_spend: number; }

export default async function PurchaseSpendReport() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("v_purchase_by_supplier").select("*").order("total_spend", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const total = rows.reduce((s, r) => s + Number(r.total_spend), 0);

  return (
    <ListShell
      title={t(locale, "Purchase Spend by Supplier")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Reports"), href: "/reports" }, { label: t(locale, "Purchase Spend") }]}
      count={rows.length}
      filterPlaceholder="Filter by supplier…"
    >
      {rows.length === 0 ? <EmptyRow text={t(locale, "No purchases recorded yet")} /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">{t(locale, "Supplier")}</th><th className="px-4 py-2 text-right">{t(locale, "Invoices")}</th><th className="px-4 py-2 text-right">{t(locale, "Total spend")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-gray-1">
            {rows.map((r, i) => (
              <tr key={r.supplier_id ?? i} className="hover:bg-surface-gray-1">
                <td className="px-4 py-2 font-medium">{r.supplier_name}</td>
                <td className="px-4 py-2 text-right text-ink-gray-5">{Number(r.invoices)}</td>
                <td className="px-4 py-2 text-right font-medium">{money(Number(r.total_spend))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t border-outline-gray-2 font-semibold"><td className="px-4 py-2" colSpan={2}>Total spend</td><td className="px-4 py-2 text-right">{money(total)}</td></tr></tfoot>
        </table>
      )}
    </ListShell>
  );
}
