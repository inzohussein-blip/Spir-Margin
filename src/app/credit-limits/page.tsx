import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { setLabCreditLimitForm } from "@/app/actions/credit";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row {
  id: string;
  code: string;
  name: string;
  credit_limit: number;
  outstanding: number;
  over_limit: boolean;
}

export default async function CreditLimitsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("v_lab_credit").select("*");
  const rows = (data as unknown as Row[]) ?? [];
  const over = rows.filter((r) => r.over_limit).length;
  const totalOutstanding = rows.reduce((s, r) => s + Number(r.outstanding), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Lab Credit Limits")}</h1>
        <Link href="/labs" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Labs</Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Over limit")} value={String(over)} accent="red" />
        <StatCard label={t(locale, "Total outstanding")} value={money(totalOutstanding)} accent="amber" />
        <StatCard label={t(locale, "Labs")} value={String(rows.length)} accent="brand" />
      </div>

      <Panel title={`${t(locale, "Credit standing")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No labs yet")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Outstanding")}</th>
                  <th className="px-4 py-2">{t(locale, "Credit limit")}</th>
                  <th className="px-4 py-2">{t(locale, "Standing")}</th>
                  <th className="px-4 py-2">{t(locale, "Set limit")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id} className={r.over_limit ? "bg-red-50/40" : ""}>
                    <td className="px-4 py-2 font-medium">
                      {r.name} <span className="text-ink-gray-4">({r.code})</span>
                    </td>
                    <td className="px-4 py-2">{money(Number(r.outstanding))}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{Number(r.credit_limit) > 0 ? money(Number(r.credit_limit)) : "—"}</td>
                    <td className="px-4 py-2">
                      {Number(r.credit_limit) === 0 ? (
                        <span className="text-xs text-ink-gray-4">no limit</span>
                      ) : r.over_limit ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">over limit</span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">within limit</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <form action={setLabCreditLimitForm} className="flex items-center gap-1">
                        <input type="hidden" name="id" value={r.id} />
                        <input name="credit_limit" type="number" step="0.01" min="0" defaultValue={Number(r.credit_limit)} className="w-28 rounded-md border border-outline-gray-2 px-2 py-1 text-xs" />
                        <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Save")}</button>
                      </form>
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
