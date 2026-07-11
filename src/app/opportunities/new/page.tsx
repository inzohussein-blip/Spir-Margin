import Link from "next/link";
import { createOpportunity } from "@/app/actions/opportunity";
import { getLabs } from "@/lib/queries";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewOpportunityPage() {
  const labs = await getLabs();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/opportunities" className="hover:text-brand">← Opportunities</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Opportunity</h1>
      <FormCard title="Opportunity details">
        <form action={createOpportunity} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Title" required>
            <TextInput name="title" required placeholder="Cobas analyzer for Al-Kindy" />
          </Field>
          <Field label="Lab">
            <Select name="lab_id" defaultValue="">
              <option value="">— none —</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </Select>
          </Field>
          <Field label="Opportunity type">
            <TextInput name="opportunity_type" placeholder="Sales / Support" />
          </Field>
          <Field label="Sales stage">
            <Select name="sales_stage" defaultValue="Prospecting">
              <option>Prospecting</option>
              <option>Qualification</option>
              <option>Needs Analysis</option>
              <option>Proposal</option>
              <option>Negotiation</option>
            </Select>
          </Field>
          <Field label="Amount">
            <TextInput name="opportunity_amount" type="number" step="0.01" />
          </Field>
          <Field label="Probability (%)">
            <TextInput name="probability" type="number" step="1" defaultValue="50" />
          </Field>
          <Field label="Expected closing">
            <TextInput name="expected_closing" type="date" />
          </Field>
          <Field label="Territory">
            <TextInput name="territory" />
          </Field>
          <Field label="Contact email">
            <TextInput name="contact_email" type="email" />
          </Field>
          <Field label="Contact mobile">
            <TextInput name="contact_mobile" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <TextArea name="notes" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create opportunity</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
