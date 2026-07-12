import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getProducts, getWarehouses } from "@/lib/queries";
import { createWorkOrder } from "@/app/actions/manufacturing";
import { Field, TextInput, TextArea, Select, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewWorkOrderPage() {
  const supabase = createClient();
  const [products, warehouses, { data: bomData }] = await Promise.all([
    getProducts(),
    getWarehouses(),
    supabase.from("boms").select("id, bom_no, product_id").eq("is_active", true).order("bom_no"),
  ]);
  const boms = (bomData ?? []) as { id: string; bom_no: string; product_id: string }[];

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/work-orders" className="hover:text-brand">← Work orders</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Work Order</h1>

      <FormCard title="Work order details">
        <form action={createWorkOrder} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="WO no." required>
            <TextInput name="wo_no" required placeholder="WO-0001" />
          </Field>
          <Field label="Finished product (kit)" required>
            <Select name="product_id" defaultValue="" required>
              <option value="">Select…</option>
              {products.map((p) => (
                <option key={p.id as string} value={p.id as string}>
                  {p.name as string}{p.item_code ? ` (${p.item_code})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="BOM">
            <Select name="bom_id" defaultValue="">
              <option value="">— none —</option>
              {boms.map((b) => <option key={b.id} value={b.id}>{b.bom_no}</option>)}
            </Select>
          </Field>
          <Field label="Qty to produce" required>
            <TextInput name="qty" type="number" step="0.01" defaultValue="1" required />
          </Field>
          <Field label="Finished-goods warehouse">
            <Select name="fg_warehouse" defaultValue="">
              <option value="">— none —</option>
              {warehouses.map((w) => <option key={w.id as string} value={w.id as string}>{w.name as string}</option>)}
            </Select>
          </Field>
          <Field label="Planned start">
            <TextInput name="planned_start" type="date" />
          </Field>
          <Field label="Planned end">
            <TextInput name="planned_end" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <TextArea name="notes" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create work order</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
