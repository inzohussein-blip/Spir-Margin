import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";
const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row { lab_id: string; lab_name: string; invoices: number; total_billed: number; total_paid: number; outstanding: number; }

export default async function SalesByLabReport() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("v_sales_by_lab").select("*").order("total_billed", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const tot = rows.reduce((a, r) => ({ billed: a.billed + Number(r.total_billed), paid: a.paid + Number(r.total_paid), out: a.out + Number(r.outstanding) }), { billed: 0, paid: 0, out: 0 });

  return (
    <ListShell
      title={t(locale, "Sales by Lab")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Reports"), href: "/reports" }, { label: t(locale, "Sales by Lab") }]}
      count={rows.length}
      filterPlaceholder="Filter by lab…"
    >
      {rows.length === 0 ? <EmptyRow text={t(locale, "No sales yet")} /> : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">{t(locale, "Lab")}</th><th className="px-4 py-2 text-right">{t(locale, "Invoices")}</th>
              <th className="px-4 py-2 text-right">{t(locale, "Billed")}</th><th className="px-4 py-2 text-right">{t(locale, "Paid")}</th><th className="px-4 py-2 text-right">{t(locale, "Outstanding")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-gray-1">
            {rows.map((r) => (
              <tr key={r.lab_id} className="hover:bg-surface-gray-1">
                <td className="px-4 py-2 font-medium">{r.lab_name}</td>
                <td className="px-4 py-2 text-right text-ink-gray-5">{Number(r.invoices)}</td>
                <td className="px-4 py-2 text-right">{money(Number(r.total_billed))}</td>
                <td className="px-4 py-2 text-right text-emerald-700">{money(Number(r.total_paid))}</td>
                <td className="px-4 py-2 text-right text-amber-700">{money(Number(r.outstanding))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr className="border-t border-outline-gray-2 font-semibold"><td className="px-4 py-2">Total</td><td /><td className="px-4 py-2 text-right">{money(tot.billed)}</td><td className="px-4 py-2 text-right">{money(tot.paid)}</td><td className="px-4 py-2 text-right">{money(tot.out)}</td></tr></tfoot>
        </table>
      )}
    </ListShell>
  );
}
