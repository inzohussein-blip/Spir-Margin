import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";
import { ValidatedForm } from "@/components/form/ValidatedForm";
import { Field, TextInput, TextArea, Select, SubmitButton } from "@/components/form/Fields";
import { CATEGORIES, stepsText, troublesText } from "@/lib/guides/core";
import { CATEGORY_LABEL, type GuideRow } from "./parts";

const big = "mt-1 w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm leading-relaxed focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

/** A guide's fields: new or edit. Steps one per line ("!" marks a warning); troubleshooting "problem | cause | fix". */
export async function GuideForm({ action, guide, submit }: {
  action: (fd: FormData) => Promise<{ error?: string } | void>;
  guide?: GuideRow;
  submit: string;
}) {
  const locale = getLocale();
  const { data } = await createClient().from("products").select("id, name").eq("is_disabled", false).order("name").limit(500);
  const products = (data as { id: string; name: string }[] | null) ?? [];
  const g = guide;
  return (
    <ValidatedForm action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field label={t(locale, "Title")} required><TextInput name="title" required defaultValue={g?.title ?? ""} /></Field></div>
      <Field label={t(locale, "Kind")}>
        <Select name="category" defaultValue={g?.category ?? "device"}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(locale, CATEGORY_LABEL[c])}</option>)}
        </Select>
      </Field>
      <Field label={t(locale, "Product in the catalogue")}>
        <Select name="product_id" defaultValue={g?.product_id ?? ""}>
          <option value="">{t(locale, "— none —")}</option>
          {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </Select>
      </Field>
      <div className="sm:col-span-2"><Field label={t(locale, "What it is for")}><TextInput name="purpose" defaultValue={g?.purpose ?? ""} /></Field></div>
      <div className="sm:col-span-2"><Field label={t(locale, "Summary")}><TextArea name="summary" defaultValue={g?.summary ?? ""} /></Field></div>
      <div className="sm:col-span-2">
        <Field label={t(locale, "Steps — one per line; start a line with ! for a warning")}>
          <textarea name="steps" rows={8} defaultValue={g ? stepsText(g.steps) : ""} className={big} />
        </Field>
      </div>
      <Field label={t(locale, "Tips from experience — one per line")}><textarea name="tips" rows={4} defaultValue={g?.tips.join("\n") ?? ""} className={big} /></Field>
      <Field label={t(locale, "Safety")}><textarea name="safety" rows={4} defaultValue={g?.safety ?? ""} className={big} /></Field>
      <div className="sm:col-span-2">
        <Field label={t(locale, "Troubleshooting — one per line: problem | cause | fix")}>
          <textarea name="troubles" rows={4} defaultValue={g ? troublesText(g.troubles) : ""} className={big} dir="auto" />
        </Field>
      </div>
      <Field label={t(locale, "Reviewed by")}><TextInput name="reviewed_by" defaultValue={g?.reviewed_by ?? ""} /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label={t(locale, "Reviewed on")}><TextInput name="reviewed_at" type="date" defaultValue={g?.reviewed_at ?? ""} /></Field>
        <Field label={t(locale, "Next review")}><TextInput name="next_review" type="date" defaultValue={g?.next_review ?? ""} /></Field>
      </div>
      <div className="sm:col-span-2"><SubmitButton>{submit}</SubmitButton></div>
    </ValidatedForm>
  );
}
