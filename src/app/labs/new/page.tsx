import Link from "next/link";
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
      <h1 className="text-2xl font-bold text-ink-gray-8">New Lab</h1>

      <FormCard title="Lab details">
        <form action={createLab} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Code" required>
            <TextInput name="code" required placeholder="LAB-004" />
          </Field>
          <Field label="Name" required>
            <TextInput name="name" required placeholder="City Central Lab" />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="active">
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </Select>
          </Field>
          <Field label="City">
            <TextInput name="city" />
          </Field>
          <Field label="Contact name">
            <TextInput name="contact_name" />
          </Field>
          <Field label="Phone">
            <TextInput name="phone" />
          </Field>
          <Field label="Email">
            <TextInput name="email" type="email" />
          </Field>
          <Field label="Territory">
            <TextInput name="territory" list="territories" />
            <datalist id="territories">
              {territories.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <Field label="Customer group">
            <TextInput name="customer_group" list="cust-groups" />
            <datalist id="cust-groups">
              {groups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </Field>
          <Field label="Latitude">
            <TextInput name="latitude" type="number" step="any" />
          </Field>
          <Field label="Longitude">
            <TextInput name="longitude" type="number" step="any" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <TextArea name="address" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create lab</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
