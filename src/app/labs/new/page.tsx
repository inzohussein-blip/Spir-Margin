import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createLab } from "@/app/actions/crud";
import { getTerritories, getCustomerGroups } from "@/lib/queries";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewLabPage() {
  const locale = getLocale();
  const [territories, groups] = await Promise.all([
    getTerritories(),
    getCustomerGroups(),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-gray-5">
        <Link href="/labs" className="hover:text-brand">
          ← Labs
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Lab")}</h1>

      <FormCard title={t(locale, "Lab details")}>
        <form action={createLab} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Code")} required>
            <TextInput name="code" required placeholder="LAB-004" />
          </Field>
          <Field label={t(locale, "Name")} required>
            <TextInput name="name" required placeholder="City Central Lab" />
          </Field>
          <Field label={t(locale, "Status")}>
            <Select name="status" defaultValue="active">
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </Select>
          </Field>
          <Field label={t(locale, "City")}>
            <TextInput name="city" />
          </Field>
          <Field label={t(locale, "Contact name")}>
            <TextInput name="contact_name" />
          </Field>
          <Field label={t(locale, "Phone")}>
            <TextInput name="phone" />
          </Field>
          <Field label={t(locale, "Email")}>
            <TextInput name="email" type="email" />
          </Field>
          <Field label={t(locale, "Territory")}>
            <TextInput name="territory" list="territories" />
            <datalist id="territories">
              {territories.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <Field label={t(locale, "Customer group")}>
            <TextInput name="customer_group" list="cust-groups" />
            <datalist id="cust-groups">
              {groups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </Field>
          <Field label={t(locale, "Latitude")}>
            <TextInput name="latitude" type="number" step="any" />
          </Field>
          <Field label={t(locale, "Longitude")}>
            <TextInput name="longitude" type="number" step="any" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Address")}>
              <TextArea name="address" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create lab")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
