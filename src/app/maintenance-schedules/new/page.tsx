import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { getLabs, getDevices } from "@/lib/queries";
import { createMaintenanceSchedule } from "@/app/actions/maintenance_schedule";
import { Field, TextInput, TextArea, Select, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewMaintenanceSchedulePage() {
  const locale = getLocale();
  const [labs, devices] = await Promise.all([getLabs(), getDevices()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/maintenance-schedules" className="hover:text-brand">← Maintenance schedules</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Maintenance Schedule</h1>

      <FormCard title="Schedule details">
        <form action={createMaintenanceSchedule} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Schedule no.")} required>
            <TextInput name="schedule_no" required placeholder="MS-0001" />
          </Field>
          <Field label={t(locale, "Device")} required>
            <Select name="device_id" defaultValue="" required>
              <option value="">Select…</option>
              {devices.map((d) => {
                const prod = (d as { products?: { name?: string } | null }).products;
                return (
                  <option key={d.id as string} value={d.id as string}>
                    {d.asset_code as string}{prod?.name ? ` · ${prod.name}` : ""}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label={t(locale, "Lab")}>
            <Select name="lab_id" defaultValue="">
              <option value="">— none —</option>
              {labs.map((l) => <option key={l.id as string} value={l.id as string}>{l.name as string}</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Periodicity")}>
            <Select name="periodicity" defaultValue="quarterly">
              <option value="weekly">weekly</option>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="half_yearly">half yearly</option>
              <option value="yearly">yearly</option>
            </Select>
          </Field>
          <Field label={t(locale, "Start date")}>
            <TextInput name="start_date" type="date" />
          </Field>
          <Field label={t(locale, "Number of visits")} required>
            <TextInput name="no_of_visits" type="number" min="1" defaultValue="4" required />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Notes")}>
              <TextArea name="notes" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create schedule")}</SubmitButton>
          </div>
        </form>
      </FormCard>
      <p className="text-xs text-ink-gray-5">After creating, press <em>Generate</em> to lay out the visit dates and set the device&apos;s next-maintenance date.</p>
    </div>
  );
}
