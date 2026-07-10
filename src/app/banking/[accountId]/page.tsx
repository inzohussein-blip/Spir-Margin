import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getBankAccount,
  getUnreconciledTransactions,
  getOpenPaymentEntries,
} from "@/lib/banking";
import { ReconcilePanel } from "@/components/banking/ReconcilePanel";

export const dynamic = "force-dynamic";

export default async function AccountReconcilePage({
  params,
}: {
  params: { accountId: string };
}) {
  const account = await getBankAccount(params.accountId);
  if (!account) notFound();

  const [transactions, payments] = await Promise.all([
    getUnreconciledTransactions(params.accountId),
    getOpenPaymentEntries(),
  ]);

  return (
    <div className="space-y-5">
      <div className="text-sm text-slate-500">
        <Link href="/banking" className="hover:text-brand">
          ← Banking
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{account.account_name}</h1>
          <p className="text-sm text-slate-400">
            {account.bank} · {account.currency}
          </p>
        </div>
        <Link
          href={`/banking/${params.accountId}/transactions/new`}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          + Manual transaction
        </Link>
      </div>

      <ReconcilePanel
        accountId={params.accountId}
        transactions={transactions as never}
        payments={payments as never}
      />
    </div>
  );
}
