import Link from "next/link";
import { getBankAccounts } from "@/lib/banking";
import { StatementImport } from "@/components/banking/StatementImport";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const accounts = await getBankAccounts();

  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/banking" className="hover:text-brand">← Banking</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">Import Bank Statement</h1>
      <p className="text-sm text-slate-500">
        CSV with automatic format detection. PDF statement import needs a
        table-extraction backend (planned).
      </p>
      {accounts.length === 0 ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Add a bank account first.
        </div>
      ) : (
        <StatementImport accounts={accounts as never} />
      )}
    </div>
  );
}
