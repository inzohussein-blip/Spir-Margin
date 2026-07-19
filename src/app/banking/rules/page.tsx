import Link from "next/link";
import { getRules } from "@/lib/banking";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Cond {
  field: string;
  operator: string;
  value: string;
}
interface Rule {
  id: string;
  rule_name: string;
  transaction_type: string;
  priority: number;
  classify_as: string;
  min_amount: number | null;
  max_amount: number | null;
  bank_rule_conditions: Cond[];
}

export default async function RulesPage() {
  const locale = getLocale();
  const rules = (await getRules()) as Rule[];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Matching Rules")}</h1>
        <div className="flex gap-2">
          <Link href="/banking" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">← Banking</Link>
          <Link href="/banking/rules/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New rule</Link>
        </div>
      </div>
      <Panel title={`${t(locale, "Rules")} (${rules.length})`}>
        {rules.length === 0 ? (
          <EmptyRow text={t(locale, "No rules yet — rules auto-classify bank lines by description/amount")} />
        ) : (
          <ul className="divide-y divide-outline-gray-1">
            {rules.map((r) => (
              <li key={r.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-ink-gray-8">
                    <span className="mr-2 rounded bg-surface-gray-2 px-1.5 py-0.5 text-xs text-ink-gray-5">#{r.priority}</span>
                    {r.rule_name}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {r.classify_as.replace(/_/g, " ")}
                    </span>
                    <Link href={`/banking/rules/${r.id}/edit`} className="text-xs font-medium text-brand hover:underline">
                      Edit
                    </Link>
                  </div>
                </div>
                <div className="mt-1 text-xs text-ink-gray-4">
                  {r.transaction_type}
                  {r.min_amount != null && ` · ≥ ${r.min_amount}`}
                  {r.max_amount != null && ` · ≤ ${r.max_amount}`}
                  {r.bank_rule_conditions?.map((c, i) => (
                    <span key={i}> · {c.field} {c.operator} “{c.value}”</span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
