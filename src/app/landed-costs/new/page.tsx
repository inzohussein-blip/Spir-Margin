import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createLandedCost } from "@/app/actions/landed_cost";
import { Field, TextInput, Select, SubmitButton, FormCard } from "@/components/form/Fields";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Receipt { id: string; receipt_no: string }

export default async function NewLandedCostPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("purchase_receipts")
    .select("id, receipt_no")
    .eq("status", "received")
    .order("receipt_no");
  const receipts = (data as unknown as Receipt[]) ?? [];

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/landed-costs" className="hover:text-brand">← {t(locale, "Landed Costs")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New landed cost")}</h1>

      <FormCard title={t(locale, "Import costs")}>
        <form action={createLandedCost} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t(locale, "Voucher no.")}>
            <TextInput name="voucher_no" placeholder="auto if blank" />
          </Field>
          <Field label={t(locale, "Purchase receipt")} required>
            <Select name="receipt_id" required defaultValue="">
              <option value="" disabled>{t(locale, "Select a received receipt…")}</option>
              {receipts.map((r) => <option key={r.id} value={r.id}>{r.receipt_no}</option>)}
            </Select>
          </Field>
          <Field label={t(locale, "Freight")}>
            <TextInput name="freight" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Customs")}>
            <TextInput name="customs" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Clearance")}>
            <TextInput name="clearance" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Other")}>
            <TextInput name="other" type="number" step="0.01" defaultValue="0" />
          </Field>
          <Field label={t(locale, "Allocation method")}>
            <Select name="allocation_method" defaultValue="by_value">
              <option value="by_value">{t(locale, "By value")}</option>
              <option value="by_qty">{t(locale, "By quantity")}</option>
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label={t(locale, "Notes")}>
              <TextInput name="notes" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <SubmitButton>{t(locale, "Create landed cost")}</SubmitButton>
          </div>
        </form>
      </FormCard>
    </div>
  );
}
