import Link from "next/link";
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
  const supplierGroups = await getSupplierGroups();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/companies" className="hover:text-brand">
          ← Companies
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Company</h1>

      <FormCard title="Company details">
        <form
          action={createCompany}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field label="Name" required>
            <TextInput name="name" required placeholder="Roche Diagnostics" />
          </Field>
          <Field label="Role">
            <Select name="role" defaultValue="supplier">
              <option value="parent">parent (manufacturer)</option>
              <option value="supplier">supplier</option>
              <option value="customer">customer</option>
            </Select>
          </Field>
          <Field label="Supplier type">
            <Select name="supplier_type" defaultValue="company">
              <option value="company">company</option>
              <option value="individual">individual</option>
              <option value="partnership">partnership</option>
            </Select>
          </Field>
          <Field label="Supplier group">
            <TextInput name="supplier_group" list="supplier-groups" />
            <datalist id="supplier-groups">
              {supplierGroups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </Field>
          <Field label="Tax ID">
            <TextInput name="tax_id" />
          </Field>
          <Field label="Country">
            <TextInput name="country" />
          </Field>
          <Field label="Phone">
            <TextInput name="phone" />
          </Field>
          <Field label="Email">
            <TextInput name="email" type="email" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>Create company</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
