import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createBankTransaction } from "@/app/actions/banking";
import { Field, TextInput, SubmitButton, FormCard } from "@/components/form/Fields";

export default function NewTransactionPage({
  params,
}: {
  params: { accountId: string };
}) {
  const locale = getLocale();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href={`/banking/${params.accountId}`} className="hover:text-brand">← Reconcile</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Bank Transaction</h1>
      <FormCard title="Statement line (manual)">
        <form action={createBankTransaction} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="bank_account_id" value={params.accountId} />
          <Field label={t(locale, "Date")}>
            <TextInput name="date" type="date" />
          </Field>
          <Field label={t(locale, "Reference number")}>
            <TextInput name="reference_number" />
          </Field>
          <Field label={t(locale, "Deposit (money in)")}>
            <TextInput name="deposit" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Withdrawal (money out)")}>
            <TextInput name="withdrawal" type="number" step="0.01" defaultValue="0" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Description")}>
              <TextInput name="description" />
            </Field>
          </div>
          <Field label={t(locale, "Bank transaction id")}>
            <TextInput name="transaction_id" placeholder="unique per account" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Add transaction")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
