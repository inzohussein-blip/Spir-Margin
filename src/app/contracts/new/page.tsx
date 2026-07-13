import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLabs, getDevices } from "@/lib/queries";
import { createContract } from "@/app/actions/contract";
import { Field, TextInput, TextArea, Select, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewContractPage() {
  const supabase = createClient();
  const [labs, devices, { data: templates }] = await Promise.all([
    getLabs(),
    getDevices(),
    supabase.from("contract_templates").select("title, contract_terms").order("title"),
  ]);
  const tpl = (templates ?? [])[0];

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/contracts" className="hover:text-brand">← Service contracts</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Service Contract</h1>

      <FormCard title="Contract details">
        <form action={createContract} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contract no." required>
            <TextInput name="contract_no" required placeholder="AMC-0001" />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="unsigned">
              <option value="unsigned">unsigned</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </Select>
          </Field>
          <Field label="Lab">
            <Select name="lab_id" defaultValue="">
              <option value="">— none —</option>
              {labs.map((l) => <option key={l.id as string} value={l.id as string}>{l.name as string}</option>)}
            </Select>
          </Field>
          <Field label="Device">
            <Select name="device_id" defaultValue="">
              <option value="">— none —</option>
              {devices.map((d) => <option key={d.id as string} value={d.id as string}>{d.asset_code as string}</option>)}
            </Select>
          </Field>
          <Field label="Start date">
            <TextInput name="start_date" type="date" />
          </Field>
          <Field label="End date">
            <TextInput name="end_date" type="date" />
          </Field>
          <Field label="Contract value">
            <TextInput name="contract_value" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label="Signee">
            <TextInput name="signee" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Terms">
              <TextArea name="contract_terms" defaultValue={tpl?.contract_terms ?? ""} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create contract</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
