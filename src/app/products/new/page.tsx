import Link from "next/link";
import { createProduct } from "@/app/actions/crud";
import { getSuppliers, getUoms, getBrands, getItemGroups } from "@/lib/queries";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const [suppliers, uoms, brands, itemGroups] = await Promise.all([
    getSuppliers(),
    getUoms(),
    getBrands(),
    getItemGroups(),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/products" className="hover:text-brand">
          ← Products
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Product</h1>

      <FormCard title="Item details">
        <form
          action={createProduct}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field label="Item code" required>
            <TextInput name="item_code" required placeholder="KIT-GLU-02" />
          </Field>
          <Field label="Name" required>
            <TextInput name="name" required />
          </Field>
          <Field label="Type" required>
            <Select name="product_type" required defaultValue="">
              <option value="" disabled>
                Select type…
              </option>
              <option value="device">device</option>
              <option value="kit">kit</option>
              <option value="spare_part">spare part</option>
            </Select>
          </Field>
          <Field label="Item group">
            <TextInput name="item_group" list="item-groups" placeholder="Reagents" />
            <datalist id="item-groups">
              {itemGroups.map((g) => <option key={g} value={g} />)}
            </datalist>
          </Field>
          <Field label="Brand">
            <TextInput name="brand" list="brands" />
            <datalist id="brands">
              {brands.map((b) => <option key={b} value={b} />)}
            </datalist>
          </Field>
          <Field label="UOM">
            <TextInput name="uom" list="uoms" defaultValue="Nos" />
            <datalist id="uoms">
              {uoms.map((u) => <option key={u} value={u} />)}
            </datalist>
          </Field>
          <Field label="Default supplier">
            <Select name="supplier_id" defaultValue="">
              <option value="">— none —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Shelf life (days)">
            <TextInput name="shelf_life_in_days" type="number" />
          </Field>
          <Field label="Default buy price">
            <TextInput name="default_buy_price" type="number" step="0.01" />
          </Field>
          <Field label="Default sell price">
            <TextInput name="default_sell_price" type="number" step="0.01" />
          </Field>
          <Field label="Reorder level">
            <TextInput name="reorder_level" type="number" step="0.01" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Description">
              <TextArea name="description" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create product</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
