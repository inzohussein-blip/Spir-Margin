import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createPaymentTerm } from "@/app/actions/purchasing";
import { getModesOfPayment } from "@/lib/queries";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewPaymentTermPage() {
  const locale = getLocale();
  const modes = await getModesOfPayment();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/payment-terms" className="hover:text-brand">← {t(locale, "Payment Terms")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Payment Term")}</h1>
      <FormCard title={t(locale, "Term")}>
        <form action={createPaymentTerm} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Name")} required>
            <TextInput name="name" required placeholder="Net 45" />
          </Field>
          <Field label={t(locale, "Invoice portion (%)")}>
            <TextInput name="invoice_portion" type="number" step="0.01" defaultValue="100" />
          </Field>
          <Field label={t(locale, "Due date based on")}>
            <Select name="due_date_based_on" defaultValue="day_after_invoice">
              <option value="day_after_invoice">Day(s) after invoice date</option>
              <option value="day_after_month_end">Day(s) after end of invoice month</option>
              <option value="month_after_month_end">Month(s) after end of invoice month</option>
            </Select>
          </Field>
          <Field label={t(locale, "Mode of payment")}>
            <TextInput name="mode_of_payment" list="pt-modes" placeholder="Wire / Cheque" />
            <datalist id="pt-modes">
              {modes.map((m) => <option key={m} value={m} />)}
            </datalist>
          </Field>
          <Field label={t(locale, "Credit days")}>
            <TextInput name="credit_days" type="number" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Credit months")}>
            <TextInput name="credit_months" type="number" defaultValue="0" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Description")}>
              <TextArea name="description" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create term")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
