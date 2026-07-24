import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createLead } from "@/app/actions/crm";
import { getTerritories } from "@/lib/queries";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  const locale = getLocale();
  const territories = await getTerritories();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/leads" className="hover:text-brand">← {t(locale, "Leads")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Lead")}</h1>
      <FormCard title={t(locale, "Lead details")}>
        <form action={createLead} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Lead name")} required>
            <TextInput name="lead_name" required placeholder="Dr. Ahmed" />
          </Field>
          <Field label={t(locale, "Company / lab name")}>
            <TextInput name="company_name" />
          </Field>
          <Field label={t(locale, "Status")}>
            <Select name="status" defaultValue="lead">
              <option value="lead">{t(locale, "lead")}</option>
              <option value="open">{t(locale, "open")}</option>
              <option value="interested">{t(locale, "interested")}</option>
              <option value="opportunity">{t(locale, "opportunity")}</option>
              <option value="do_not_contact">{t(locale, "do not contact")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Source")}>
            <TextInput name="source" placeholder="Referral / Exhibition / Web" />
          </Field>
          <Field label={t(locale, "Email")}>
            <TextInput name="email" type="email" />
          </Field>
          <Field label={t(locale, "Mobile")}>
            <TextInput name="mobile_no" />
          </Field>
          <Field label={t(locale, "City")}>
            <TextInput name="city" />
          </Field>
          <Field label={t(locale, "Territory")}>
            <TextInput name="territory" list="lead-territories" />
            <datalist id="lead-territories">
              {territories.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <Field label={t(locale, "Industry")}>
            <TextInput name="industry" placeholder="Diagnostics / Hospital" />
          </Field>
          <Field label={t(locale, "Country")}>
            <TextInput name="country" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Notes")}>
              <TextArea name="notes" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create lead")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
