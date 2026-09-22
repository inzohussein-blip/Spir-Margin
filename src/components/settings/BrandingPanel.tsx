"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { Loader2Icon, AlertTriangleIcon, CheckCircle2Icon, ImageIcon } from "lucide-react";
import { saveBrandingAction, type BrandingState } from "@/app/actions/branding";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import type { Branding } from "@/lib/branding";

function SaveButton() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-dark active:scale-95 disabled:opacity-60"
    >
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : null}
      {t(locale, "Save")}
    </button>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-gray-7">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-ink-gray-5">{hint}</span> : null}
    </label>
  );
}

const input =
  "mt-1 block w-full rounded-md border border-outline-gray-2 bg-surface-white px-3 py-2 text-sm text-ink-gray-8 placeholder:text-ink-gray-4 focus:border-brand focus:outline-none";

/**
 * The company's identity, as it appears on every document it prints.
 *
 * Kept on this machine only — a second branch sets its own — which is also
 * why the document prefix lives here: it is what keeps two machines from
 * numbering two different receipts the same.
 */
export function BrandingPanel({ branding }: { branding: Branding }) {
  const locale = useLocale();
  const [state, formAction] = useFormState(saveBrandingAction, null as BrandingState | null);
  const [removeLogo, setRemoveLogo] = useState(false);

  return (
    <form action={formAction} className="space-y-5 p-5">
      <p className="text-sm leading-relaxed text-ink-gray-6">
        {t(locale, "These details are printed on receipts, authorisations and every other document. They stay on this computer and are not sent anywhere.")}
      </p>

      {/* Logo */}
      <div className="flex flex-wrap items-start gap-4 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-4">
        <div className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-lg border border-outline-gray-2 bg-surface-white">
          {branding.logo && !removeLogo ? (
            // Stored as a data URI on this machine, so a plain <img> is right.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logo} alt="" className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon size={26} className="text-ink-gray-3" />
          )}
        </div>
        <div className="min-w-[16rem] flex-1">
          <Field
            label={t(locale, "Company logo")}
            hint={t(locale, "PNG, JPEG, SVG or WebP, under 512 KB. Leave empty to keep the current one.")}
          >
            <input
              type="file"
              name="logo"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="mt-1 block w-full cursor-pointer rounded-md border border-outline-gray-2 bg-surface-white p-2 text-sm text-ink-gray-7 file:me-3 file:rounded file:border-0 file:bg-surface-gray-2 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-ink-gray-7"
            />
          </Field>
          {branding.logo ? (
            <label className="mt-2 flex items-center gap-2 text-sm text-ink-gray-6">
              <input
                type="checkbox"
                name="remove_logo"
                value="yes"
                checked={removeLogo}
                onChange={(e) => setRemoveLogo(e.target.checked)}
                className="size-4 rounded border-outline-gray-3 text-red-600"
              />
              {t(locale, "Remove the current logo")}
            </label>
          ) : null}
        </div>
      </div>

      {/* Identity */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(locale, "Company name")}>
          <input name="company_name" defaultValue={branding.companyName ?? ""} className={input}
            placeholder={t(locale, "As it should appear on documents")} />
        </Field>
        <Field label={t(locale, "Tagline")}>
          <input name="tagline" defaultValue={branding.tagline ?? ""} className={input}
            placeholder={t(locale, "A short line under the name")} />
        </Field>
        <Field label={t(locale, "Address")}>
          <input name="address" defaultValue={branding.address ?? ""} className={input} />
        </Field>
        <Field label={t(locale, "City")}>
          <input name="city" defaultValue={branding.city ?? ""} className={input} />
        </Field>
        <Field label={t(locale, "Phone")}>
          <input name="phone" defaultValue={branding.phone ?? ""} className={input} dir="ltr" />
        </Field>
        <Field label={t(locale, "Email")}>
          <input name="email" type="email" defaultValue={branding.email ?? ""} className={input} dir="ltr" />
        </Field>
        <Field label={t(locale, "Website")}>
          <input name="website" defaultValue={branding.website ?? ""} className={input} dir="ltr" />
        </Field>
        <Field label={t(locale, "Tax number")}>
          <input name="tax_id" defaultValue={branding.taxId ?? ""} className={input} dir="ltr" />
        </Field>
      </div>

      {/* Documents */}
      <div className="grid gap-4 border-t border-outline-gray-2 pt-5 sm:grid-cols-2">
        <Field
          label={t(locale, "Document prefix")}
          hint={t(locale, "Goes in front of every document number. Leave it empty and this computer uses a tag of its own, so two computers can never share a number either way.")}
        >
          <input name="doc_prefix" defaultValue={branding.docPrefix ?? ""} className={input}
            dir="ltr" maxLength={8} placeholder="SPR" />
        </Field>
        <Field label={t(locale, "Footer line")} hint={t(locale, "Printed along the bottom of every document.")}>
          <input name="footer_note" defaultValue={branding.footerNote ?? ""} className={input} />
        </Field>
        <Field label={t(locale, "Watermark text")} hint={t(locale, "Printed faintly across the page.")}>
          <input name="watermark_text" defaultValue={branding.watermarkText ?? ""} className={input}
            placeholder={t(locale, "The company name is used when this is empty")} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink-gray-7">
          <input
            type="checkbox"
            name="watermark_on"
            defaultChecked={branding.watermarkOn}
            className="size-4 rounded border-outline-gray-3 text-brand"
          />
          {t(locale, "Show the watermark on printed documents")}
        </label>
      </div>

      <SaveButton />

      {state?.error ? (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
          <span>{t(locale, state.error)}</span>
        </div>
      ) : null}
      {state?.ok ? (
        <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
          <CheckCircle2Icon size={16} className="mt-0.5 shrink-0" />
          <span>{t(locale, state.message ?? "Saved")}</span>
        </div>
      ) : null}
    </form>
  );
}
