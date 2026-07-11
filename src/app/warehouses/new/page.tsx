import Link from "next/link";
import { createWarehouse } from "@/app/actions/crud";
import { createClient } from "@/lib/supabase/server";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewWarehousePage() {
  const supabase = createClient();
  const { data } = await supabase.from("warehouse_types").select("name").order("name");
  const types = (data ?? []).map((t) => t.name as string);
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/warehouses" className="hover:text-brand">
          ← Warehouses
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">New Warehouse</h1>

      <FormCard title="Warehouse details">
        <form
          action={createWarehouse}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          <Field label="Name" required>
            <TextInput name="name" required placeholder="Cold Store - Erbil" />
          </Field>
          <Field label="Type">
            <Select name="warehouse_type" defaultValue="">
              <option value="">— none —</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="City">
            <TextInput name="city" />
          </Field>
          <Field label="Phone">
            <TextInput name="phone" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Address">
              <TextArea name="address" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>Create warehouse</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
