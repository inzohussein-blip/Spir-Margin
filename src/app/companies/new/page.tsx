import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createCompany } from "@/app/actions/crud";
import { getSupplierGroups } from "@/lib/queries";
import {
  Field,
  TextInput,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewCompanyPage() {
  const locale = getLocale();
  const supplierGroups = await getSupplierGroups();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/companies" className="hover:text-brand">
          ← Companies
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Company")}</h1>

      <FormCard title={t(locale, "Company details")}>
        <form
          action={createCompany}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field label={t(locale, "Name")} required>
            <TextInput name="name" required placeholder="Roche Diagnostics" />
          </Field>
          <Field label={t(locale, "Role")}>
            <Select name="role" defaultValue="supplier">
              <option value="parent">{t(locale, "parent (manufacturer)")}</option>
              <option value="supplier">{t(locale, "supplier")}</option>
              <option value="customer">{t(locale, "customer")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Supplier type")}>
            <Select name="supplier_type" defaultValue="company">
              <option value="company">{t(locale, "company")}</option>
              <option value="individual">{t(locale, "individual")}</option>
              <option value="partnership">{t(locale, "partnership")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Supplier group")}>
            <TextInput name="supplier_group" list="supplier-groups" />
            <datalist id="supplier-groups">
              {supplierGroups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </Field>
          <Field label={t(locale, "Tax ID")}>
            <TextInput name="tax_id" />
          </Field>
          <Field label={t(locale, "Country")}>
            <TextInput name="country" />
          </Field>
          <Field label={t(locale, "Phone")}>
            <TextInput name="phone" />
          </Field>
          <Field label={t(locale, "Email")}>
            <TextInput name="email" type="email" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create company")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
