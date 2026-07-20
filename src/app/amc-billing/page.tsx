import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { SubmitButton } from "@/components/form/Fields";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { generateAmcInvoices } from "@/app/actions/amc";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row {
  id: string;
  contract_no: string;
  lab_name: string;
  billing_interval: string;
  next_billing_date: string;
  period_amount: number;
  service_item: string | null;
  service_name: string | null;
  days_overdue: number;
}

export default async function AmcBillingPage({
  searchParams,
}: {
  searchParams: { generated?: string };
}) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("v_amc_due").select("*");
  const rows = (data as unknown as Row[]) ?? [];
  const totalDue = rows.reduce((s, r) => s + Number(r.period_amount), 0);
  const generated = searchParams.generated != null ? Number(searchParams.generated) : null;

  return (
    <ListShell
      title={t(locale, "AMC Billing")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Accounting") }]}
      count={rows.length}
      filterPlaceholder={t(locale, "Filter by contract / lab…")}
    >
      {generated != null ? (
        <div className="mx-4 mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {generated > 0
            ? `${t(locale, "Generated invoices")}: ${generated}`
            : t(locale, "No contracts were due for billing.")}
        </div>
      ) : null}

      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm text-ink-gray-5">
          {t(locale, "Draft invoices will be created for all contracts due today.")}
        </p>
        <form action={generateAmcInvoices}>
          <SubmitButton disabled={rows.length === 0}>{t(locale, "Generate invoices")}</SubmitButton>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyRow text={t(locale, "No contracts are due for billing.")} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">{t(locale, "Contract no.")}</th>
              <th className="px-4 py-2">{t(locale, "Lab")}</th>
              <th className="px-4 py-2">{t(locale, "Service item")}</th>
              <th className="px-4 py-2">{t(locale, "Interval")}</th>
              <th className="px-4 py-2">{t(locale, "Next billing date")}</th>
              <th className="px-4 py-2 text-right">{t(locale, "Overdue (days)")}</th>
              <th className="px-4 py-2 text-right">{t(locale, "Period amount")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-gray-1">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-gray-1">
                <td className="px-4 py-2 font-medium">{r.contract_no}</td>
                <td className="px-4 py-2">{r.lab_name}</td>
                <td className="px-4 py-2 text-ink-gray-5">{r.service_name ?? r.service_item ?? "—"}</td>
                <td className="px-4 py-2">{t(locale, r.billing_interval)}</td>
                <td className="px-4 py-2 text-ink-gray-5">{r.next_billing_date}</td>
                <td className="px-4 py-2 text-right">{Number(r.days_overdue) > 0 ? Number(r.days_overdue) : 0}</td>
                <td className="px-4 py-2 text-right">{money(Number(r.period_amount))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-outline-gray-2 font-semibold">
              <td className="px-4 py-2" colSpan={6}>{t(locale, "Total due")}</td>
              <td className="px-4 py-2 text-right">{money(totalDue)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </ListShell>
  );
}
