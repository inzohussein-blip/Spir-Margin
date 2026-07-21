import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createKitBatch } from "@/app/actions/crud";
import { getProducts, getWarehouses, getSuppliers } from "@/lib/queries";
import {
  Field,
  TextInput,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewKitBatchPage() {
  const locale = getLocale();
  const [products, warehouses, suppliers] = await Promise.all([
    getProducts("kit"),
    getWarehouses(),
    getSuppliers(),
  ]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/kits" className="hover:text-brand">
          ← Kits
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Kit Batch")}</h1>

      <FormCard title={t(locale, "Batch details")}>
        <form
          action={createKitBatch}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field label={t(locale, "Batch no.")} required>
            <TextInput name="batch_no" required placeholder="B-GLU-2403" />
          </Field>
          <Field label={t(locale, "Product (kit)")} required>
            <Select name="product_id" required defaultValue="">
              <option value="" disabled>
                Select a kit…
              </option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.item_code})
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Warehouse")}>
            <Select name="warehouse_id" defaultValue="">
              <option value="">— none —</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Supplier")}>
            <Select name="supplier_id" defaultValue="">
              <option value="">— none —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Manufacturing date")}>
            <TextInput name="manufacturing_date" type="date" />
          </Field>
          <Field label={t(locale, "Expiry date")}>
            <TextInput name="expiry_date" type="date" />
          </Field>
          <Field label={t(locale, "Qty received")} required>
            <TextInput name="qty_received" type="number" step="0.01" required />
          </Field>
          <div />
          <Field label={t(locale, "Buy price (from parent co.)")}>
            <TextInput name="buy_price" type="number" step="0.01" />
          </Field>
          <Field label={t(locale, "Sell price (to lab)")}>
            <TextInput name="sell_price" type="number" step="0.01" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create batch")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
