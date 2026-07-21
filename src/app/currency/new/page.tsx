import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createExchangeRate } from "@/app/actions/currency";
import { Field, TextInput, Checkbox, SubmitButton, FormCard } from "@/components/form/Fields";

export default function NewRatePage() {
  const locale = getLocale();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/currency" className="hover:text-brand">← {t(locale, "Currency Exchange")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Exchange Rate")}</h1>
      <FormCard title={t(locale, "Rate")}>
        <form action={createExchangeRate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Date")}><TextInput name="date" type="date" /></Field>
          <Field label={t(locale, "Rate")} required><TextInput name="exchange_rate" type="number" step="0.000001" required /></Field>
          <Field label={t(locale, "From currency")} required><TextInput name="from_currency" required placeholder="USD" /></Field>
          <Field label={t(locale, "To currency")} required><TextInput name="to_currency" required placeholder="IQD" /></Field>
          <div className="flex items-end gap-4">
            <Checkbox name="for_buying" label="For buying" defaultChecked />
            <Checkbox name="for_selling" label="For selling" defaultChecked />
          </div>
          <div className="sm:col-span-2"><SubmitButton>{t(locale, "Create rate")}</SubmitButton></div>
        </form>
      </FormCard>
    </div>
  );
}
