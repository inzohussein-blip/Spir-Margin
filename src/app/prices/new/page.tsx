import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createItemPrice } from "@/app/actions/pricing";
import { getProducts, getLabs, getSuppliers, getPriceLists } from "@/lib/queries";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  Checkbox,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewItemPricePage() {
  const locale = getLocale();
  const [products, labs, suppliers, priceLists] = await Promise.all([
    getProducts(),
    getLabs(),
    getSuppliers(),
    getPriceLists(),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/prices" className="hover:text-brand">← {t(locale, "Prices")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Item Price")}</h1>
      <FormCard title={t(locale, "Price details")}>
        <form action={createItemPrice} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Product")} required>
            <Select name="product_id" required defaultValue="">
              <option value="" disabled>{t(locale, "Select a product…")}</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.item_code})</option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Price list")}>
            <TextInput name="price_list" list="price-lists" defaultValue="Standard Selling" />
            <datalist id="price-lists">
              {priceLists.map((p) => <option key={p} value={p} />)}
            </datalist>
          </Field>
          <Field label={t(locale, "Rate")} required>
            <TextInput name="rate" type="number" step="0.01" required />
          </Field>
          <Field label={t(locale, "Currency")}>
            <TextInput name="currency" defaultValue="USD" />
          </Field>
          <Field label={t(locale, "Lab (optional — leave empty for all labs)")}>
            <Select name="lab_id" defaultValue="">
              <option value="">— all labs —</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Supplier (optional)")}>
            <Select name="supplier_id" defaultValue="">
              <option value="">— none —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Valid from")}>
            <TextInput name="valid_from" type="date" />
          </Field>
          <Field label={t(locale, "Valid upto")}>
            <TextInput name="valid_upto" type="date" />
          </Field>
          <div className="flex items-end gap-4">
            <Checkbox name="selling" label="Selling" defaultChecked />
            <Checkbox name="buying" label="Buying" />
          </div>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Note")}>
              <TextArea name="note" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create price")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
