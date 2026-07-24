import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createSerialNumber } from "@/app/actions/serials";
import { getProducts, getLabs, getWarehouses } from "@/lib/queries";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewSerialPage() {
  const locale = getLocale();
  const [products, labs, warehouses] = await Promise.all([
    getProducts(),
    getLabs(),
    getWarehouses(),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/serials" className="hover:text-brand">← {t(locale, "Serials")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Serial Number")}</h1>
      <FormCard title={t(locale, "Serial details")}>
        <form action={createSerialNumber} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Serial no.")} required>
            <TextInput name="serial_no" required placeholder="SN-000123" />
          </Field>
          <Field label={t(locale, "Product")} required>
            <Select name="product_id" required defaultValue="">
              <option value="" disabled>Select a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.item_code})</option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Status")}>
            <Select name="status" defaultValue="active">
              <option value="active">{t(locale, "active")}</option>
              <option value="inactive">{t(locale, "inactive")}</option>
              <option value="consumed">{t(locale, "consumed")}</option>
              <option value="delivered">{t(locale, "delivered")}</option>
              <option value="expired">{t(locale, "expired")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Warranty status")}>
            <Select name="maintenance_status" defaultValue="">
              <option value="">— none —</option>
              <option value="under_warranty">{t(locale, "under warranty")}</option>
              <option value="out_of_warranty">{t(locale, "out of warranty")}</option>
              <option value="under_amc">{t(locale, "under AMC")}</option>
              <option value="out_of_amc">{t(locale, "out of AMC")}</option>
            </Select>
          </Field>
          <Field label={t(locale, "Warehouse")}>
            <Select name="warehouse_id" defaultValue="">
              <option value="">— none —</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Lab")}>
            <Select name="lab_id" defaultValue="">
              <option value="">— none —</option>
              {labs.map((l) => <option key={l.id} value={l.id}>{l.name} ({l.code})</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Purchase rate")}>
            <TextInput name="purchase_rate" type="number" step="0.01" />
          </Field>
          <Field label={t(locale, "Warranty period (days)")}>
            <TextInput name="warranty_period_days" type="number" />
          </Field>
          <Field label={t(locale, "Warranty expiry")}>
            <TextInput name="warranty_expiry_date" type="date" />
          </Field>
          <Field label={t(locale, "AMC expiry")}>
            <TextInput name="amc_expiry_date" type="date" />
          </Field>
          <Field label={t(locale, "Batch no.")}>
            <TextInput name="batch_no" />
          </Field>
          <div />
          <div className="sm:col-span-2">
            <Field label={t(locale, "Description")}>
              <TextArea name="description" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create serial")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
