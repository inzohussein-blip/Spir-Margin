import Link from "next/link";
import { getPaymentEntries } from "@/lib/banking";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface PE {
  id: string;
  naming_series: string | null;
  payment_type: string;
  party_name: string | null;
  paid_amount: number;
  received_amount: number;
  reference_no: string | null;
  posting_date: string;
  is_reconciled: boolean;
}

export default async function PaymentsPage() {
  const locale = getLocale();
  const rows = (await getPaymentEntries()) as PE[];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Payment Entries")}</h1>
        <div className="flex gap-2">
          <Link href="/banking" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">← {t(locale, "Banking")}</Link>
          <Link href="/banking/payments/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ {t(locale, "New payment")}</Link>
        </div>
      </div>
      <Panel title={`${t(locale, "All Payments")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No payment entries yet")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Ref")}</th>
                  <th className="px-4 py-2">{t(locale, "Type")}</th>
                  <th className="px-4 py-2">{t(locale, "Party")}</th>
                  <th className="px-4 py-2">{t(locale, "Amount")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Reconciled")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2 font-medium">{p.naming_series ?? p.reference_no ?? "—"}</td>
                    <td className="px-4 py-2">{p.payment_type}</td>
                    <td className="px-4 py-2">{p.party_name ?? "—"}</td>
                    <td className="px-4 py-2">
                      {Number(p.received_amount || p.paid_amount).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{p.posting_date}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.is_reconciled ? "bg-emerald-100 text-emerald-700" : "bg-surface-gray-2 text-ink-gray-5"}`}>
                        {p.is_reconciled ? "yes" : "no"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
