import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  name: string;
  due_date_based_on: string;
  credit_days: number;
  credit_months: number;
  invoice_portion: number;
}

const basisLabel: Record<string, string> = {
  day_after_invoice: "days after invoice",
  day_after_month_end: "days after month end",
  month_after_month_end: "months after month end",
};

export default async function PaymentTermsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("payment_terms")
    .select("id, name, due_date_based_on, credit_days, credit_months, invoice_portion")
    .order("name");
  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Payment Terms")}</h1>
        <div className="flex gap-2">
          <Link href="/purchases" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">← Purchases</Link>
          <Link href="/payment-terms/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New term</Link>
        </div>
      </div>
      <Panel title={`${t(locale, "Terms")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No payment terms yet")} />
        ) : (
          <ul className="divide-y divide-outline-gray-1">
            {rows.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="font-medium text-ink-gray-8">{t.name}</span>
                <span className="text-ink-gray-5">
                  {t.due_date_based_on === "month_after_month_end"
                    ? `${t.credit_months} ${basisLabel[t.due_date_based_on]}`
                    : `${t.credit_days} ${basisLabel[t.due_date_based_on]}`}
                  {" · "}{t.invoice_portion}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
