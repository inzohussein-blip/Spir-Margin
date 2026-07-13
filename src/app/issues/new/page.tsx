import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLabs, getDevices } from "@/lib/queries";
import { createIssue } from "@/app/actions/support";
import { Field, TextInput, TextArea, Select, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewIssuePage() {
  const supabase = createClient();
  const [labs, devices, { data: types }, { data: prios }] = await Promise.all([
    getLabs(),
    getDevices(),
    supabase.from("issue_types").select("name").order("name"),
    supabase.from("issue_priorities").select("name").order("name"),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/issues" className="hover:text-brand">← Support issues</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Support Issue</h1>

      <FormCard title="Issue details">
        <form action={createIssue} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Issue no." required>
            <TextInput name="issue_no" required placeholder="ISS-0001" />
          </Field>
          <Field label="Subject" required>
            <TextInput name="subject" required placeholder="Analyzer error on startup" />
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
              {devices.map((d) => (
                <option key={d.id as string} value={d.id as string}>{d.asset_code as string}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priority">
            <Select name="priority" defaultValue="">
              <option value="">—</option>
              {(prios ?? []).map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Type">
            <Select name="issue_type" defaultValue="">
              <option value="">—</option>
              {(types ?? []).map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
            </Select>
          </Field>
          <Field label="Raised by">
            <TextInput name="raised_by" placeholder="name / email" />
          </Field>
          <Field label="Opening date">
            <TextInput name="opening_date" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <TextArea name="description" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create issue</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
