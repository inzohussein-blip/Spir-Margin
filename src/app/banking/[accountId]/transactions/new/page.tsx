import Link from "next/link";
import { createBankTransaction } from "@/app/actions/banking";
import { Field, TextInput, SubmitButton, FormCard } from "@/components/form/Fields";

export default function NewTransactionPage({
  params,
}: {
  params: { accountId: string };
}) {
  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href={`/banking/${params.accountId}`} className="hover:text-brand">← Reconcile</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">New Bank Transaction</h1>
      <FormCard title="Statement line (manual)">
        <form action={createBankTransaction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="bank_account_id" value={params.accountId} />
          <Field label="Date">
            <TextInput name="date" type="date" />
          </Field>
          <Field label="Reference number">
            <TextInput name="reference_number" />
          </Field>
          <Field label="Deposit (money in)">
            <TextInput name="deposit" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label="Withdrawal (money out)">
            <TextInput name="withdrawal" type="number" step="0.01" defaultValue="0" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <TextInput name="description" />
            </Field>
          </div>
          <Field label="Bank transaction id">
            <TextInput name="transaction_id" placeholder="unique per account" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Add transaction</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
