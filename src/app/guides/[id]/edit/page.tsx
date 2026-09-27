import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { FormCard } from "@/components/form/Fields";
import { GuideForm } from "@/components/guides/GuideForm";
import { updateGuide } from "@/app/actions/guides";
import { guides } from "@/components/guides/parts";

export const dynamic = "force-dynamic";

export default async function EditGuidePage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const g = (await guides()).find((x) => x.id === params.id);
  if (!g) notFound();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5"><Link href={`/guides/${g.id}`} className="hover:text-brand"><span aria-hidden>→</span> {g.title}</Link></div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Edit the guide")}</h1>
      <FormCard title={t(locale, "The guide")}><GuideForm action={updateGuide.bind(null, g.id)} guide={g} submit={t(locale, "Save changes")} /></FormCard>
    </div>
  );
}
