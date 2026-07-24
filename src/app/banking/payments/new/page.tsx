import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
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
  const locale = getLocale();
  const [accounts, parties, modes] = await Promise.all([
    getBankAccounts(),
    getPartyOptions(),
    getModesOfPayment(),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/banking/payments" className="hover:text-brand">← {t(locale, "Payments")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Payment Entry")}</h1>
      <FormCard title={t(locale, "Payment details")}>
        <form action={createPaymentEntry} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Payment type")} required>
            <Select name="payment_type" required defaultValue="receive">
              <option value="receive">{t(locale, "Receive (from lab)")}</option>
              <option value="pay">{t(locale, "Pay (to supplier)")}</option>
              <option value="internal_transfer">{t(locale, "Internal transfer")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Posting date")}>
            <TextInput name="posting_date" type="date" />
          </Field>
          <Field label={t(locale, "Party")}>
            <Select name="party" defaultValue="">
              <option value="">— none —</option>
              {parties.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Party name (free text)")}>
            <TextInput name="party_name" />
          </Field>
          <Field label={t(locale, "Amount")} required>
            <TextInput name="amount" type="number" step="0.01" required />
          </Field>
          <Field label={t(locale, "Mode of payment")}>
            <TextInput name="mode_of_payment" list="modes" placeholder="Wire / Cash / Cheque" />
            <datalist id="modes">
              {modes.map((m) => <option key={m} value={m} />)}
            </datalist>
          </Field>
          <Field label={t(locale, "Bank account")}>
            <Select name="bank_account_id" defaultValue="">
              <option value="">— none —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.account_name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Reference no.")}>
            <TextInput name="reference_no" />
          </Field>
          <Field label={t(locale, "Reference date")}>
            <TextInput name="reference_date" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create payment")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
