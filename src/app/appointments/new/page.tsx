import Link from "next/link";
import { getLabs, getDevices } from "@/lib/queries";
import { createAppointment } from "@/app/actions/appointment";
import { Field, TextInput, TextArea, Select, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage() {
  const [labs, devices] = await Promise.all([getLabs(), getDevices()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/appointments" className="hover:text-brand">← Appointments</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Appointment</h1>

      <FormCard title="Appointment details">
        <form action={createAppointment} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Appointment no." required>
            <TextInput name="appointment_no" required placeholder="APT-0001" />
          </Field>
          <Field label="Purpose">
            <Select name="purpose" defaultValue="service">
              <option value="installation">installation</option>
              <option value="service">service</option>
              <option value="training">training</option>
              <option value="other">other</option>
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
          <Field label="Scheduled time" required>
            <TextInput name="scheduled_time" type="datetime-local" required />
          </Field>
          <Field label="Status">
            <Select name="status" defaultValue="open">
              <option value="open">open</option>
              <option value="confirmed">confirmed</option>
            </Select>
          </Field>
          <Field label="Contact name">
            <TextInput name="contact_name" />
          </Field>
          <Field label="Contact phone">
            <TextInput name="contact_phone" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <TextArea name="notes" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create appointment</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
