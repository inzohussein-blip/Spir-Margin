import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createDevice } from "@/app/actions/crud";
import { getProducts, getLabs, getAssetCategories } from "@/lib/queries";
import {
  Field,
  TextInput,
  Select,
  Checkbox,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewDevicePage() {
  const locale = getLocale();
  const [products, labs, assetCategories] = await Promise.all([
    getProducts("device"),
    getLabs(),
    getAssetCategories(),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/devices" className="hover:text-brand">
          ← Devices
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Device")}</h1>

      <FormCard title={t(locale, "Device details")}>
        <form
          action={createDevice}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field label={t(locale, "Asset code")} required>
            <TextInput name="asset_code" required placeholder="ACC-ASS-0005" />
          </Field>
          <Field label={t(locale, "Product")} required>
            <Select name="product_id" required defaultValue="">
              <option value="" disabled>
                Select a device…
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.item_code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Serial no.")}>
            <TextInput name="serial_no" />
          </Field>
          <Field label={t(locale, "Status")}>
            <Select name="status" defaultValue="in_stock">
              <option value="in_stock">{t(locale, "in stock")}</option>
              <option value="installed">{t(locale, "installed")}</option>
              <option value="in_maintenance">{t(locale, "in maintenance")}</option>
              <option value="out_of_order">{t(locale, "out of order")}</option>
              <option value="retired">{t(locale, "retired")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Lab (location)")}>
            <Select name="lab_id" defaultValue="">
              <option value="">— unassigned —</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Custodian")}>
            <TextInput name="custodian_name" />
          </Field>
          <Field label={t(locale, "Asset category")}>
            <TextInput name="asset_category" list="asset-cats" />
            <datalist id="asset-cats">
              {assetCategories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label={t(locale, "Purchase date")}>
            <TextInput name="purchase_date" type="date" />
          </Field>
          <Field label={t(locale, "Purchase price")}>
            <TextInput name="purchase_price" type="number" step="0.01" />
          </Field>
          <Field label={t(locale, "Next maintenance date")}>
            <TextInput name="next_maintenance_date" type="date" />
          </Field>
          <div className="flex items-end">
            <Checkbox name="maintenance_required" label="Maintenance required" />
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create device")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
