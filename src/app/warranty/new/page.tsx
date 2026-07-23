import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createWarrantyClaim } from "@/app/actions/support";
import { getProducts, getLabs } from "@/lib/queries";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewWarrantyClaimPage() {
  const locale = getLocale();
  const [products, labs] = await Promise.all([getProducts(), getLabs()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/warranty" className="hover:text-brand">← {t(locale, "Warranty Claims")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Warranty Claim")}</h1>
      <FormCard title={t(locale, "Claim details")}>
        <form action={createWarrantyClaim} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Complaint date")}>
            <TextInput name="complaint_date" type="date" />
          </Field>
          <Field label={t(locale, "Status")}>
            <Select name="status" defaultValue="open">
              <option value="open">open</option>
              <option value="work_in_progress">work in progress</option>
              <option value="closed">closed</option>
              <option value="cancelled">cancelled</option>
            </Select>
          </Field>
          <Field label={t(locale, "Product")}>
            <Select name="product_id" defaultValue="">
              <option value="">— none —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.item_code})</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Lab")}>
            <Select name="lab_id" defaultValue="">
              <option value="">— none —</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Warranty / AMC status")}>
            <Select name="warranty_amc_status" defaultValue="">
              <option value="">— none —</option>
              <option value="under_warranty">under warranty</option>
              <option value="out_of_warranty">out of warranty</option>
              <option value="under_amc">under AMC</option>
              <option value="out_of_amc">out of AMC</option>
            </Select>
          </Field>
          <Field label={t(locale, "Raised by")}>
            <TextInput name="complaint_raised_by" />
          </Field>
          <Field label={t(locale, "Contact mobile")}>
            <TextInput name="contact_mobile" />
          </Field>
          <Field label={t(locale, "Contact email")}>
            <TextInput name="contact_email" type="email" />
          </Field>
          <Field label={t(locale, "Billed to")}>
            <Select name="billed_to" defaultValue="agent">
              <option value="agent">{t(locale, "Agent (under warranty)")}</option>
              <option value="hospital">{t(locale, "Hospital (billable)")}</option>
              <option value="insurance">{t(locale, "Insurance")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Charge amount")}>
            <TextInput name="charge_amount" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Insurer name")}>
            <TextInput name="insurer_name" placeholder={t(locale, "if insurance")} />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Complaint")}>
              <TextArea name="complaint" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create claim")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
