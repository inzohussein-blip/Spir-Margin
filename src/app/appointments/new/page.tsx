import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { getLabs, getDevices } from "@/lib/queries";
import { createAppointment } from "@/app/actions/appointment";
import { Field, TextInput, TextArea, Select, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewAppointmentPage() {
  const locale = getLocale();
  const [labs, devices] = await Promise.all([getLabs(), getDevices()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/appointments" className="hover:text-brand">← {t(locale, "Appointments")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Appointment")}</h1>

      <FormCard title={t(locale, "Appointment details")}>
        <form action={createAppointment} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Appointment no.")} required>
            <TextInput name="appointment_no" required placeholder="APT-0001" />
          </Field>
          <Field label={t(locale, "Purpose")}>
            <Select name="purpose" defaultValue="service">
              <option value="installation">{t(locale, "installation")}</option>
              <option value="service">{t(locale, "service")}</option>
              <option value="training">{t(locale, "training")}</option>
              <option value="other">{t(locale, "other")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Lab")}>
            <Select name="lab_id" defaultValue="">
              <option value="">— none —</option>
              {labs.map((l) => <option key={l.id as string} value={l.id as string}>{l.name as string}</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Device")}>
            <Select name="device_id" defaultValue="">
              <option value="">— none —</option>
              {devices.map((d) => <option key={d.id as string} value={d.id as string}>{d.asset_code as string}</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Scheduled time")} required>
            <TextInput name="scheduled_time" type="datetime-local" required />
          </Field>
          <Field label={t(locale, "Status")}>
            <Select name="status" defaultValue="open">
              <option value="open">{t(locale, "open")}</option>
              <option value="confirmed">{t(locale, "confirmed")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Contact name")}>
            <TextInput name="contact_name" />
          </Field>
          <Field label={t(locale, "Contact phone")}>
            <TextInput name="contact_phone" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Notes")}>
              <TextArea name="notes" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create appointment")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
