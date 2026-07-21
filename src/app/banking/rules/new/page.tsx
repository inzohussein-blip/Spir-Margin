import Link from "next/link";
import { getPartyOptions } from "@/lib/banking";
import { RuleForm } from "@/components/banking/RuleForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewRulePage() {
  const locale = getLocale();
  const parties = await getPartyOptions();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/banking/rules" className="hover:text-brand">← {t(locale, "Rules")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Matching Rule")}</h1>
      <RuleForm parties={parties} />
    </div>
  );
}
