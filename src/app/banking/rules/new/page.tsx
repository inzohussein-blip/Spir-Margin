import Link from "next/link";
import { createRule } from "@/app/actions/banking";
import { getPartyOptions } from "@/lib/banking";
import {
  Field,
  TextInput,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewRulePage() {
  const parties = await getPartyOptions();
  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/banking/rules" className="hover:text-brand">← Rules</Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">New Matching Rule</h1>
      <FormCard title="Rule">
        <form action={createRule} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Rule name" required>
            <TextInput name="rule_name" required placeholder="Al-Kindy inflows" />
          </Field>
          <Field label="Priority">
            <TextInput name="priority" type="number" defaultValue="1" />
          </Field>
          <Field label="Applies to">
            <Select name="transaction_type" defaultValue="any">
              <option value="any">any</option>
              <option value="deposit">deposit</option>
              <option value="withdrawal">withdrawal</option>
            </Select>
          </Field>
          <Field label="Classify as">
            <Select name="classify_as" defaultValue="payment_entry">
              <option value="payment_entry">payment entry</option>
              <option value="bank_entry">bank entry</option>
              <option value="transfer">transfer</option>
            </Select>
          </Field>
          <Field label="Min amount">
            <TextInput name="min_amount" type="number" step="0.01" />
          </Field>
          <Field label="Max amount">
            <TextInput name="max_amount" type="number" step="0.01" />
          </Field>
          <Field label="Set party (optional)">
            <Select name="party" defaultValue="">
              <option value="">— none —</option>
              {parties.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </Select>
          </Field>
          <div />
          <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-3 text-sm font-semibold text-slate-600">
            Condition (matched against the bank line)
          </div>
          <Field label="Field">
            <Select name="condition_field" defaultValue="description">
              <option value="description">description</option>
              <option value="reference_number">reference number</option>
            </Select>
          </Field>
          <Field label="Operator">
            <Select name="condition_operator" defaultValue="contains">
              <option value="contains">contains</option>
              <option value="equals">equals</option>
              <option value="starts_with">starts with</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Value">
              <TextInput name="condition_value" placeholder="AL-KINDY" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create rule</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
