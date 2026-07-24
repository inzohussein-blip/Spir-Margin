import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { DailyRateCard } from "@/components/tools/DailyRateCard";
import { getUsdIqdRate } from "@/app/actions/currency";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string; date: string; from_currency: string; to_currency: string;
  exchange_rate: number; for_buying: boolean; for_selling: boolean;
}

export default async function CurrencyPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("currency_exchanges")
    .select("id, date, from_currency, to_currency, exchange_rate, for_buying, for_selling")
    .order("date", { ascending: false });
  const rows = (data as Row[]) ?? [];
  const [usdIqd, user] = await Promise.all([getUsdIqdRate(), getCurrentUser()]);
  const canSetRate = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Currency Exchange")}</h1>
        <Link href="/currency/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ {t(locale, "New rate")}</Link>
      </div>

      {canSetRate ? <DailyRateCard currentRate={usdIqd} /> : null}
      <Panel title={`${t(locale, "Rates")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No exchange rates yet")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "From")}</th>
                  <th className="px-4 py-2">{t(locale, "To")}</th>
                  <th className="px-4 py-2">{t(locale, "Rate")}</th>
                  <th className="px-4 py-2">{t(locale, "For")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-ink-gray-5">{r.date}</td>
                    <td className="px-4 py-2 font-medium">{r.from_currency}</td>
                    <td className="px-4 py-2 font-medium">{r.to_currency}</td>
                    <td className="px-4 py-2">{Number(r.exchange_rate).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                    <td className="px-4 py-2 text-xs text-ink-gray-5">
                      {r.for_buying && "buying "}{r.for_selling && "selling"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
