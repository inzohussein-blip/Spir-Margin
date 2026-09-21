import { PlusIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBankAccount,
  getUnreconciledTransactions,
  getOpenPaymentEntries,
} from "@/lib/banking";
import { ReconcilePanel } from "@/components/banking/ReconcilePanel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AccountReconcilePage({
  params,
}: {
  params: { accountId: string };
}) {
  const locale = getLocale();
  const account = await getBankAccount(params.accountId);
  if (!account) notFound();

  const [transactions, payments] = await Promise.all([
    getUnreconciledTransactions(params.accountId),
    getOpenPaymentEntries(),
  ]);

  return (
    <div className="space-y-5">
      <div className="text-sm text-ink-gray-5">
        <Link href="/banking" className="hover:text-brand">
          <span aria-hidden>→</span> {t(locale, "Banking")}
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8">{account.account_name}</h1>
          <p className="text-sm text-ink-gray-4">
            {account.bank} · {account.currency}
          </p>
        </div>
        <Link
          href={`/banking/${params.accountId}/transactions/new`}
          className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1"
        ><PlusIcon size={15} /> {t(locale, "Manual transaction")}</Link>
      </div>

      <ReconcilePanel
        accountId={params.accountId}
        transactions={transactions as never}
        payments={payments as never}
      />
    </div>
  );
}
