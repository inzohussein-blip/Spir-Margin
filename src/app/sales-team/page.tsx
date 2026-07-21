import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function SalesTeamPage() {
  const locale = getLocale();
  const supabase = createClient();
  const [{ data: persons }, { data: partners }] = await Promise.all([
    supabase.from("sales_persons").select("id, name, commission_rate, is_group, enabled").order("name"),
    supabase.from("sales_partners").select("id, name, partner_type, commission_rate").order("name"),
  ]);
  const ps = (persons as { id: string; name: string; commission_rate: number; is_group: boolean; enabled: boolean }[]) ?? [];
  const pt = (partners as { id: string; name: string; partner_type: string | null; commission_rate: number }[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Sales Team")}</h1>
        <Link href="/opportunities" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">← {t(locale, "Opportunities")}</Link>
      </div>
      <Panel title={`${t(locale, "Sales Persons")} (${ps.length})`}>
        {ps.length === 0 ? <EmptyRow text={t(locale, "No sales persons")} /> : (
          <ul className="divide-y divide-outline-gray-1">
            {ps.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className={p.is_group ? "font-semibold text-ink-gray-8" : "pl-4 text-ink-gray-7"}>{p.name}</span>
                <span className="text-ink-gray-5">{Number(p.commission_rate)}% {p.enabled ? "" : "· disabled"}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <Panel title={`${t(locale, "Sales Partners / Channels")} (${pt.length})`}>
        {pt.length === 0 ? <EmptyRow text={t(locale, "No sales partners")} /> : (
          <ul className="divide-y divide-outline-gray-1">
            {pt.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="font-medium text-ink-gray-8">{p.name} <span className="text-xs text-ink-gray-4">{p.partner_type ?? ""}</span></span>
                <span className="text-ink-gray-5">{Number(p.commission_rate)}%</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
