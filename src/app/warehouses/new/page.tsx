import Link from "next/link";
import { createWarehouse } from "@/app/actions/crud";
import {
  Field,
  TextInput,
  TextArea,
  Select,
  SubmitButton,
  FormCard,
} from "@/components/form/Fields";

export default function NewWarehousePage() {
  return (
    <div className="space-y-4">
      <div className="text-sm text-slate-500">
        <Link href="/warehouses" className="hover:text-brand">
          ← Warehouses
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-slate-800">New Warehouse</h1>

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
              <option value="Stock">Stock</option>
              <option value="Cold">Cold</option>
              <option value="Transit">Transit</option>
              <option value="Rejected">Rejected</option>
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
