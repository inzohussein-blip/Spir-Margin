import Link from "next/link";
import { TaxTemplateForm } from "@/components/accounts/TaxTemplateForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export default function NewTaxTemplatePage() {
  const locale = getLocale();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/taxes" className="hover:text-brand">← {t(locale, "Taxes")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Tax Template")}</h1>
      <TaxTemplateForm />
    </div>
  );
}
