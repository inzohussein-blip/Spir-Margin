import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { getProducts, getLabs } from "@/lib/queries";
import { createPricingRule } from "@/app/actions/pricing_rule";
import { Field, TextInput, Select, SubmitButton, FormCard } from "@/components/form/Fields";

export const dynamic = "force-dynamic";

export default async function NewPricingRulePage() {
  const locale = getLocale();
  const [products, labs] = await Promise.all([getProducts(), getLabs()]);

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/pricing-rules" className="hover:text-brand">← {t(locale, "Pricing rules")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Pricing Rule")}</h1>

      <FormCard title={t(locale, "Rule")}>
        <form action={createPricingRule} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Title")} required>
            <TextInput name="title" required placeholder="Bulk kit discount" />
          </Field>
          <Field label={t(locale, "Discount %")} required>
            <TextInput name="discount_percentage" type="number" step="0.01" defaultValue="0" required />
          </Field>
          <Field label={t(locale, "Product (blank = any)")}>
            <Select name="product_id" defaultValue="">
              <option value="">any product</option>
              {products.map((p) => (
                <option key={p.id as string} value={p.id as string}>{p.name as string}</option>
              ))}
            </Select>
          </Field>
          <Field label={t(locale, "Lab (blank = any)")}>
            <Select name="lab_id" defaultValue="">
              <option value="">any lab</option>
              {labs.map((l) => <option key={l.id as string} value={l.id as string}>{l.name as string}</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Min qty")}>
            <TextInput name="min_qty" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Max qty (blank = ∞)")}>
            <TextInput name="max_qty" type="number" step="0.01" />
          </Field>
          <Field label={t(locale, "Valid from")}>
            <TextInput name="valid_from" type="date" />
          </Field>
          <Field label={t(locale, "Valid upto")}>
            <TextInput name="valid_upto" type="date" />
          </Field>
          <Field label={t(locale, "Priority")}>
            <TextInput name="priority" type="number" defaultValue="0" />
          </Field>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create rule")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
