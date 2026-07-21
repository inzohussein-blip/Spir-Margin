import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { getDevices } from "@/lib/queries";
import { createAssetRepair } from "@/app/actions/asset_repair";
import { Field, TextInput, TextArea, Select, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewAssetRepairPage() {
  const locale = getLocale();
  const devices = await getDevices();

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/asset-repairs" className="hover:text-brand">← {t(locale, "Asset repairs")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Asset Repair")}</h1>

      <FormCard title={t(locale, "Repair details")}>
        <form action={createAssetRepair} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Repair no.")} required>
            <TextInput name="repair_no" required placeholder="AR-0001" />
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
          <Field label={t(locale, "Failure date")}>
            <TextInput name="failure_date" type="date" />
          </Field>
          <Field label={t(locale, "Repair cost")}>
            <TextInput name="repair_cost" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Downtime")}>
            <TextInput name="downtime" placeholder="e.g. 3 days" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Problem description")}>
              <TextArea name="description" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Actions performed")}>
              <TextArea name="actions_performed" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Raise repair")}</SubmitButton>
          </div>
        </form>
      </FormCard>
      <p className="text-xs text-ink-gray-5">Raising a repair marks the device as <em>in maintenance</em> until completed.</p>
    </div>
  );
}
