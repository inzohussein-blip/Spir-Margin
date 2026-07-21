import Link from "next/link";
import { CurrencyConverter } from "@/components/tools/CurrencyConverter";
import { DailyRateCard } from "@/components/tools/DailyRateCard";
import { getUsdIqdRate } from "@/app/actions/currency";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function ConverterPage() {
  const locale = getLocale();
  const [rate, user] = await Promise.all([getUsdIqdRate(), getCurrentUser()]);
  const canSetRate = user?.role === "admin" || user?.role === "manager";
  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5"><Link href="/tools" className="hover:text-brand">← {t(locale, "Tools")}</Link></div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Currency Converter")}</h1>
      <CurrencyConverter rate={rate} />
      {canSetRate ? <DailyRateCard currentRate={rate} /> : null}
    </div>
  );
}
