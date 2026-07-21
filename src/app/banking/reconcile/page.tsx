import Link from "next/link";
import { getBankAccounts } from "@/lib/banking";
import { ReconcileWorkbench } from "@/components/banking/ReconcileWorkbench";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function ReconcileWorkbenchPage() {
  const locale = getLocale();
  const accounts = await getBankAccounts();

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/banking" className="hover:text-brand">← {t(locale, "Banking")}</Link>
      </div>
      {accounts.length === 0 ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Add a bank account first.
        </div>
      ) : (
        <ReconcileWorkbench
          accounts={accounts.map((a) => ({
            id: a.id,
            account_name: a.account_name,
            bank: a.bank,
            currency: a.currency,
          }))}
        />
      )}
    </div>
  );
}
