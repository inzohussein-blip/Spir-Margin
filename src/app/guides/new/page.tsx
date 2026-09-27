import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { FormCard } from "@/components/form/Fields";
import { GuideForm } from "@/components/guides/GuideForm";
import { createGuide } from "@/app/actions/guides";

export const dynamic = "force-dynamic";

export default function NewGuidePage() {
  const locale = getLocale();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5"><Link href="/guides" className="hover:text-brand"><span aria-hidden>→</span> {t(locale, "Guides")}</Link></div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New guide")}</h1>
      <FormCard title={t(locale, "The guide")}><GuideForm action={createGuide} submit={t(locale, "Save the guide")} /></FormCard>
    </div>
  );
}
