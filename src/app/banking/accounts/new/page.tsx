import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
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
  const locale = getLocale();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/banking" className="hover:text-brand">← {t(locale, "Banking")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Bank Account")}</h1>
      <FormCard title={t(locale, "Account details")}>
        <form action={createBankAccount} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Account name")} required>
            <TextInput name="account_name" required placeholder="Main Operating" />
          </Field>
          <Field label={t(locale, "Bank")} required>
            <TextInput name="bank" required placeholder="Trade Bank of Iraq" />
          </Field>
          <Field label={t(locale, "Account type")}>
            <Select name="account_type" defaultValue="">
              <option value="">— none —</option>
              <option value="Current">Current</option>
              <option value="Savings">{t(locale, "Savings")}</option>
              <option value="Credit Card">Credit Card</option>
            </Select>
          </Field>
          <Field label={t(locale, "Account no.")}>
            <TextInput name="account_no" />
          </Field>
          <Field label={t(locale, "IBAN")}>
            <TextInput name="iban" />
          </Field>
          <Field label={t(locale, "Currency")}>
            <TextInput name="currency" defaultValue="USD" />
          </Field>
          <div className="flex items-end gap-4">
            <Checkbox name="is_company_account" label="Company account" defaultChecked />
            <Checkbox name="is_default" label="Default" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create account")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
