import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { StatCard } from "@/components/dashboard/StatCard";
import { EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row {
  id: string; invoice_no: string; lab_name: string; posting_date: string;
  due_date: string | null; outstanding: number; days_overdue: number; bucket: string;
}

const BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"];

export default async function ReceivablesReport() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("v_ar_aging").select("*").order("days_overdue", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const total = rows.reduce((s, r) => s + Number(r.outstanding), 0);
  const byBucket = Object.fromEntries(BUCKETS.map((b) => [b, rows.filter((r) => r.bucket === b).reduce((s, r) => s + Number(r.outstanding), 0)]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {BUCKETS.map((b) => (
          <StatCard key={b} label={b === "current" ? "Current" : `${b} days`} value={money(byBucket[b])} accent={b === "90+" ? "red" : b === "current" ? "green" : "amber"} />
        ))}
      </div>

      <ListShell
        title={t(locale, "Accounts Receivable Aging")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Reports"), href: "/reports" }, { label: t(locale, "Receivables") }]}
        count={rows.length}
        filterPlaceholder="Filter by invoice / lab…"
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No outstanding invoices — everything is paid up")} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "Invoice")}</th><th className="px-4 py-2">{t(locale, "Lab")}</th>
                <th className="px-4 py-2">{t(locale, "Date")}</th><th className="px-4 py-2">{t(locale, "Due")}</th>
                <th className="px-4 py-2 text-right">{t(locale, "Days overdue")}</th>
                <th className="px-4 py-2">{t(locale, "Bucket")}</th><th className="px-4 py-2 text-right">{t(locale, "Outstanding")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-gray-1">
                  <td className="px-4 py-2 font-medium">{r.invoice_no}</td>
                  <td className="px-4 py-2">{r.lab_name}</td>
                  <td className="px-4 py-2 text-ink-gray-5">{r.posting_date}</td>
                  <td className="px-4 py-2 text-ink-gray-5">{r.due_date ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{r.days_overdue}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.bucket === "90+" ? "bg-red-100 text-red-700" : r.bucket === "current" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{r.bucket}</span>
                  </td>
                  <td className="px-4 py-2 text-right font-medium">{money(Number(r.outstanding))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-outline-gray-2 font-semibold">
                <td className="px-4 py-2" colSpan={6}>{t(locale, "Total outstanding")}</td>
                <td className="px-4 py-2 text-right">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </ListShell>
    </div>
  );
}
