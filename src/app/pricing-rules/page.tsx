import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { togglePricingRuleForm, deletePricingRuleForm } from "@/app/actions/pricing_rule";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  title: string;
  disabled: boolean;
  min_qty: number;
  max_qty: number | null;
  discount_percentage: number;
  valid_from: string | null;
  valid_upto: string | null;
  products: { name: string } | null;
  labs: { name: string } | null;
}

export default async function PricingRulesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("pricing_rules")
    .select("id, title, disabled, min_qty, max_qty, discount_percentage, valid_from, valid_upto, products(name), labs(name)")
    .order("priority", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Pricing Rules")}</h1>
        <Link href="/pricing-rules/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New rule</Link>
      </div>

      <Panel title={`${t(locale, "Rules")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No pricing rules yet — add a lab/quantity discount")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Title")}</th>
                  <th className="px-4 py-2">{t(locale, "Product")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Qty band")}</th>
                  <th className="px-4 py-2">{t(locale, "Discount")}</th>
                  <th className="px-4 py-2">{t(locale, "Valid")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id} className={r.disabled ? "opacity-50" : ""}>
                    <td className="px-4 py-2 font-medium">{r.title}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.products?.name ?? "any"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.labs?.name ?? "any"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {Number(r.min_qty)}{r.max_qty != null ? `–${Number(r.max_qty)}` : "+"}
                    </td>
                    <td className="px-4 py-2 font-medium text-emerald-700">{Number(r.discount_percentage)}%</td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {r.valid_from ?? "—"}{r.valid_upto ? ` → ${r.valid_upto}` : ""}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        <form action={togglePricingRuleForm}>
                          <input type="hidden" name="id" value={r.id} />
                          <input type="hidden" name="disabled" value={String(!r.disabled)} />
                          <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">
                            {r.disabled ? "Enable" : "Disable"}
                          </button>
                        </form>
                        <form action={deletePricingRuleForm}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">Delete</button>
                        </form>
                      </div>
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
