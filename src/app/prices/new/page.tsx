import Link from "next/link";
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
  const [products, labs, suppliers, priceLists] = await Promise.all([
    getProducts(),
    getLabs(),
    getSuppliers(),
    getPriceLists(),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/prices" className="hover:text-brand">← Prices</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Item Price</h1>
      <FormCard title="Price details">
        <form action={createItemPrice} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product" required>
            <Select name="product_id" required defaultValue="">
              <option value="" disabled>Select a product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.item_code})</option>
              ))}
            </Select>
          </Field>
          <Field label="Price list">
            <TextInput name="price_list" list="price-lists" defaultValue="Standard Selling" />
            <datalist id="price-lists">
              {priceLists.map((p) => <option key={p} value={p} />)}
            </datalist>
          </Field>
          <Field label="Rate" required>
            <TextInput name="rate" type="number" step="0.01" required />
          </Field>
          <Field label="Currency">
            <TextInput name="currency" defaultValue="USD" />
          </Field>
          <Field label="Lab (optional — leave empty for all labs)">
            <Select name="lab_id" defaultValue="">
              <option value="">— all labs —</option>
              {labs.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </Select>
          </Field>
          <Field label="Supplier (optional)">
            <Select name="supplier_id" defaultValue="">
              <option value="">— none —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Valid from">
            <TextInput name="valid_from" type="date" />
          </Field>
          <Field label="Valid upto">
            <TextInput name="valid_upto" type="date" />
          </Field>
          <div className="flex items-end gap-4">
            <Checkbox name="selling" label="Selling" defaultChecked />
            <Checkbox name="buying" label="Buying" />
          </div>
          <div className="sm:col-span-2">
            <Field label="Note">
              <TextArea name="note" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create price</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
