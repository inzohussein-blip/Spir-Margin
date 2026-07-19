import Link from "next/link";
import { Calculator } from "@/components/tools/Calculator";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function CalculatorPage() {
  const locale = getLocale();
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5"><Link href="/tools" className="hover:text-brand">← Tools</Link></div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Calculator")}</h1>
      <Calculator />
    </div>
  );
}
