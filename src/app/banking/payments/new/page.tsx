import Link from "next/link";
import { createPaymentEntry } from "@/app/actions/banking";
import { getBankAccounts, getPartyOptions } from "@/lib/banking";
import { getModesOfPayment } from "@/lib/queries";
import {
  Field,
  TextInput,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewPaymentPage() {
  const [accounts, parties, modes] = await Promise.all([
    getBankAccounts(),
    getPartyOptions(),
    getModesOfPayment(),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/banking/payments" className="hover:text-brand">← Payments</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Payment Entry</h1>
      <FormCard title="Payment details">
        <form action={createPaymentEntry} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Payment type" required>
            <Select name="payment_type" required defaultValue="receive">
              <option value="receive">Receive (from lab)</option>
              <option value="pay">Pay (to supplier)</option>
              <option value="internal_transfer">Internal transfer</option>
            </Select>
          </Field>
          <Field label="Posting date">
            <TextInput name="posting_date" type="date" />
          </Field>
          <Field label="Party">
            <Select name="party" defaultValue="">
              <option value="">— none —</option>
              {parties.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Party name (free text)">
            <TextInput name="party_name" />
          </Field>
          <Field label="Amount" required>
            <TextInput name="amount" type="number" step="0.01" required />
          </Field>
          <Field label="Mode of payment">
            <TextInput name="mode_of_payment" list="modes" placeholder="Wire / Cash / Cheque" />
            <datalist id="modes">
              {modes.map((m) => <option key={m} value={m} />)}
            </datalist>
          </Field>
          <Field label="Bank account">
            <Select name="bank_account_id" defaultValue="">
              <option value="">— none —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Reference no.">
            <TextInput name="reference_no" />
          </Field>
          <Field label="Reference date">
            <TextInput name="reference_date" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Create payment</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
