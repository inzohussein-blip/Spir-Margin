import Link from "next/link";
import { createInternalTransfer } from "@/app/actions/banking";
import { getBankAccounts } from "@/lib/banking";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function TransferPage() {
  const accounts = await getBankAccounts();

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/banking" className="hover:text-brand">← Banking</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">Internal Transfer</h1>
      {accounts.length < 2 ? (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Add at least two bank accounts to record a transfer.
        </div>
      ) : (
        <FormCard title="Move funds between company accounts">
          <form action={createInternalTransfer} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="From account" required>
              <Select name="from_account_id" required defaultValue="">
                <option value="" disabled>Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
                ))}
              </Select>
            </Field>
            <Field label="To account" required>
              <Select name="to_account_id" required defaultValue="">
                <option value="" disabled>Select…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.account_name} ({a.currency})</option>
                ))}
              </Select>
            </Field>
            <Field label="Amount" required>
              <TextInput name="amount" type="number" step="0.01" required />
            </Field>
            <Field label="Date">
              <TextInput name="date" type="date" />
            </Field>
            <Field label="Reference no.">
              <TextInput name="reference_no" placeholder="auto if empty" />
            </Field>
            <div />
            <div className="sm:col-span-2">
              <Field label="Remarks">
                <TextArea name="remarks" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Record transfer</SubmitButton>
            </div>
          </form>
        </FormCard>
      )}
    </div>
  );
}
