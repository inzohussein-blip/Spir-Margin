import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row { id: string; title: string; applies_to: string; tax_category: string | null; is_default: boolean; tax_template_rows: { rate: number; description: string }[]; }

export default async function TaxesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("tax_templates")
    .select("id, title, applies_to, tax_category, is_default, tax_template_rows(rate, description)")
    .order("title");
  const rows = (data as unknown as Row[]) ?? [];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Tax Templates")}</h1>
        <div className="flex gap-2">
          <Link href="/accounts" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Accounts")}</Link>
          <Link href="/taxes/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New template</Link>
        </div>
      </div>
      <Panel title={`${t(locale, "Templates")} (${rows.length})`}>
        {rows.length === 0 ? <EmptyRow text={t(locale, "No tax templates")} /> : (
          <ul className="divide-y divide-outline-gray-1">
            {rows.map((t) => (
              <li key={t.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-ink-gray-8">{t.title} {t.is_default && <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-700">default</span>}</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{t.applies_to}</span>
                </div>
                <div className="mt-1 text-xs text-ink-gray-4">
                  {t.tax_category ? `${t.tax_category} · ` : ""}
                  {t.tax_template_rows?.map((r, i) => <span key={i}>{i > 0 ? " · " : ""}{r.description} {Number(r.rate)}%</span>)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
