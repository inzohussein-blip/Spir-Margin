import Link from "next/link";
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
  const territories = await getTerritories();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/leads" className="hover:text-brand">← Leads</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Lead</h1>
      <FormCard title="Lead details">
        <form action={createLead} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Lead name" required>
            <TextInput name="lead_name" required placeholder="Dr. Ahmed" />
          </Field>
          <Field label="Company / lab name">
            <TextInput name="company_name" />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="lead">
              <option value="lead">lead</option>
              <option value="open">open</option>
              <option value="interested">interested</option>
              <option value="opportunity">opportunity</option>
              <option value="do_not_contact">do not contact</option>
            </Select>
          </Field>
          <Field label="Source">
            <TextInput name="source" placeholder="Referral / Exhibition / Web" />
          </Field>
          <Field label="Email">
            <TextInput name="email" type="email" />
          </Field>
          <Field label="Mobile">
            <TextInput name="mobile_no" />
          </Field>
          <Field label="City">
            <TextInput name="city" />
          </Field>
          <Field label="Territory">
            <TextInput name="territory" list="lead-territories" />
            <datalist id="lead-territories">
              {territories.map((t) => <option key={t} value={t} />)}
            </datalist>
          </Field>
          <Field label="Industry">
            <TextInput name="industry" placeholder="Diagnostics / Hospital" />
          </Field>
          <Field label="Country">
            <TextInput name="country" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <TextArea name="notes" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create lead</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
