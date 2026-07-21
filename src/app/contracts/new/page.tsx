import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { getLabs, getDevices, getProducts } from "@/lib/queries";
import { createContract } from "@/app/actions/contract";
import { Field, TextInput, TextArea, Select, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewContractPage() {
  const locale = getLocale();
  const supabase = createClient();
  const [labs, devices, products, { data: templates }] = await Promise.all([
    getLabs(),
    getDevices(),
    getProducts(),
    supabase.from("contract_templates").select("title, contract_terms").order("title"),
  ]);
  const tpl = (templates ?? [])[0];

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/contracts" className="hover:text-brand">← {t(locale, "Service contracts")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Service Contract")}</h1>

      <FormCard title={t(locale, "Contract details")}>
        <form action={createContract} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Contract no.")} required>
            <TextInput name="contract_no" required placeholder="AMC-0001" />
          </Field>
          <Field label={t(locale, "Status")}>
            <Select name="status" defaultValue="unsigned">
              <option value="unsigned">unsigned</option>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
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
          <Field label={t(locale, "Start date")}>
            <TextInput name="start_date" type="date" />
          </Field>
          <Field label={t(locale, "End date")}>
            <TextInput name="end_date" type="date" />
          </Field>
          <Field label={t(locale, "Contract value")}>
            <TextInput name="contract_value" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Signee")}>
            <TextInput name="signee" />
          </Field>
          <div className="sm:col-span-2 mt-2 border-t border-outline-gray-1 pt-3">
            <p className="mb-1 text-xs font-semibold uppercase text-ink-gray-4">Recurring billing (AMC)</p>
            <p className="text-xs text-ink-gray-5">
              Set an interval, the service item to charge, and the first billing date to auto-generate invoices from the AMC Billing page.
            </p>
          </div>
          <Field label={t(locale, "Billing interval")}>
            <Select name="billing_interval" defaultValue="none">
              <option value="none">none (no recurring billing)</option>
              <option value="monthly">monthly</option>
              <option value="quarterly">quarterly</option>
              <option value="annually">annually</option>
            </Select>
          </Field>
          <Field label={t(locale, "Service item")}>
            <Select name="service_product_id" defaultValue="">
              <option value="">— none —</option>
              {products.map((p) => (
                <option key={p.id as string} value={p.id as string}>
                  {(p.name as string) ?? (p.item_code as string)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Next billing date")}>
            <TextInput name="next_billing_date" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Terms")}>
              <TextArea name="contract_terms" defaultValue={tpl?.contract_terms ?? ""} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create contract")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
