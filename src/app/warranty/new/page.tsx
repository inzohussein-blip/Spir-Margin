import Link from "next/link";
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
  const [products, labs] = await Promise.all([getProducts(), getLabs()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/warranty" className="hover:text-brand">← Warranty Claims</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Warranty Claim</h1>
      <FormCard title="Claim details">
        <form action={createWarrantyClaim} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Complaint date">
            <TextInput name="complaint_date" type="date" />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="open">
              <option value="open">open</option>
              <option value="work_in_progress">work in progress</option>
              <option value="closed">closed</option>
              <option value="cancelled">cancelled</option>
            </Select>
          </Field>
          <Field label="Product">
            <Select name="product_id" defaultValue="">
              <option value="">— none —</option>
              {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.item_code})</option>)}
            </Select>
          </Field>
          <Field label="Lab">
            <Select name="lab_id" defaultValue="">
              <option value="">— none —</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </Select>
          </Field>
          <Field label="Warranty / AMC status">
            <Select name="warranty_amc_status" defaultValue="">
              <option value="">— none —</option>
              <option value="under_warranty">under warranty</option>
              <option value="out_of_warranty">out of warranty</option>
              <option value="under_amc">under AMC</option>
              <option value="out_of_amc">out of AMC</option>
            </Select>
          </Field>
          <Field label="Raised by">
            <TextInput name="complaint_raised_by" />
          </Field>
          <Field label="Contact mobile">
            <TextInput name="contact_mobile" />
          </Field>
          <Field label="Contact email">
            <TextInput name="contact_email" type="email" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Complaint">
              <TextArea name="complaint" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create claim</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
