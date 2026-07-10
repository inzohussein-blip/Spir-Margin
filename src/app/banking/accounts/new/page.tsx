import Link from "next/link";
import { createBankAccount } from "@/app/actions/banking";
import {
  Field,
  TextInput,
  Select,
  Checkbox,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export default function NewBankAccountPage() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/banking" className="hover:text-brand">← Banking</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">New Bank Account</h1>
      <FormCard title="Account details">
        <form action={createBankAccount} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Account name" required>
            <TextInput name="account_name" required placeholder="Main Operating" />
          </Field>
          <Field label="Bank" required>
            <TextInput name="bank" required placeholder="Trade Bank of Iraq" />
          </Field>
          <Field label="Account type">
            <Select name="account_type" defaultValue="">
              <option value="">— none —</option>
              <option value="Current">Current</option>
              <option value="Savings">Savings</option>
              <option value="Credit Card">Credit Card</option>
            </Select>
          </Field>
          <Field label="Account no.">
            <TextInput name="account_no" />
          </Field>
          <Field label="IBAN">
            <TextInput name="iban" />
          </Field>
          <Field label="Currency">
            <TextInput name="currency" defaultValue="USD" />
          </Field>
          <div className="flex items-end gap-4">
            <Checkbox name="is_company_account" label="Company account" defaultChecked />
            <Checkbox name="is_default" label="Default" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create account</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
