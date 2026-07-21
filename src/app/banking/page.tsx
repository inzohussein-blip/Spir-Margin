import Link from "next/link";
import { getRecSummary } from "@/lib/banking";
import { StatCard } from "@/components/dashboard/StatCard";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Summary {
  bank_account_id: string;
  account_name: string;
  bank: string;
  currency: string;
  total_deposits: number;
  total_withdrawals: number;
  unreconciled_amount: number;
  unreconciled_count: number;
  reconciled_count: number;
}

export default async function BankingPage() {
  const locale = getLocale();
  const summary = (await getRecSummary()) as Summary[];

  const totalUnrec = summary.reduce((s, a) => s + Number(a.unreconciled_amount), 0);
  const totalUnrecCount = summary.reduce((s, a) => s + Number(a.unreconciled_count), 0);
  const totalRecCount = summary.reduce((s, a) => s + Number(a.reconciled_count), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Banking")}</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/banking/reconcile" className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark">⇄ Reconcile</Link>
          <Link href="/banking/payments" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Payments")}</Link>
          <Link href="/banking/transfer" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Transfer")}</Link>
          <Link href="/banking/rules" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Rules")}</Link>
          <Link href="/banking/import" className="rounded-md border border-brand px-3 py-2 text-sm font-medium text-brand hover:bg-blue-50">{t(locale, "Import statement")}</Link>
          <Link href="/banking/accounts/new" className="rounded-md bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ Bank account</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Unreconciled amount")} value={totalUnrec.toLocaleString()} hint="across all accounts" accent="amber" />
        <StatCard label={t(locale, "Unreconciled lines")} value={String(totalUnrecCount)} accent="red" />
        <StatCard label={t(locale, "Reconciled lines")} value={String(totalRecCount)} accent="green" />
      </div>

      <Panel title={`${t(locale, "Bank Accounts")} (${summary.length})`}>
        {summary.length === 0 ? (
          <EmptyRow text={t(locale, "No bank accounts yet — add one to begin reconciliation")} />
        ) : (
          <ul className="divide-y divide-outline-gray-1">
            {summary.map((a) => (
              <li key={a.bank_account_id}>
                <Link
                  href={`/banking/${a.bank_account_id}`}
                  className="flex items-center justify-between px-4 py-4 hover:bg-surface-gray-1"
                >
                  <div>
                    <div className="font-medium text-ink-gray-8">{a.account_name}</div>
                    <div className="text-xs text-ink-gray-4">{a.bank} · {a.currency}</div>
                  </div>
                  <div className="flex items-center gap-6 text-right text-sm">
                    <div>
                      <div className="text-xs text-ink-gray-4">{t(locale, "Unreconciled")}</div>
                      <div className="font-semibold text-amber-600">
                        {Number(a.unreconciled_amount).toLocaleString()} ({a.unreconciled_count})
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-ink-gray-4">{t(locale, "Reconciled")}</div>
                      <div className="font-semibold text-emerald-600">{a.reconciled_count}</div>
                    </div>
                    <span className="text-brand">→</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
