import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { localDate } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { AsTable, BarList, Columns, type Datum } from "@/components/charts/Bars";

export const dynamic = "force-dynamic";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);
const compact = (n: number) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n || 0);
const BUCKETS = ["current", "1-30", "31-60", "61-90", "90+"] as const;

/**
 * The company at a glance (from spir-lab-manager's insights): sales by month
 * over a year, the best-selling products and the biggest customers, what is
 * owed by age, and the kits running out of date. The same amounts as the
 * reports (their views), drawn.
 */
export default async function InsightsPage() {
  const locale = getLocale();
  const today = localDate();
  const start = `${Number(today.slice(0, 4)) - 1}-${today.slice(5, 7)}-01`;
  const supabase = createClient();
  const [inv, prod, labs, aging, kits] = await Promise.all([
    supabase.from("sales_invoices").select("posting_date, total_amount, status").gte("posting_date", start).neq("status", "cancelled"),
    supabase.from("v_sales_by_product").select("product_name, revenue, qty_sold").order("revenue", { ascending: false }).limit(8),
    supabase.from("v_sales_by_lab").select("lab_id, lab_name, total_billed, outstanding").order("total_billed", { ascending: false }).limit(8),
    supabase.from("v_ar_aging").select("outstanding, bucket"),
    supabase.from("v_expiring_kits").select("id, days_until_expiry"),
  ]);

  // Twelve months ending this one, oldest first.
  const months: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1 - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const byMonth = new Map(months.map((m) => [m, 0]));
  for (const r of (inv.data as { posting_date: string; total_amount: number }[] | null) ?? []) {
    const m = String(r.posting_date).slice(0, 7);
    if (byMonth.has(m)) byMonth.set(m, (byMonth.get(m) ?? 0) + Number(r.total_amount || 0));
  }
  const monthData: Datum[] = months.map((m) => ({ label: m.slice(2).replace("-", "/"), value: Math.round(byMonth.get(m) ?? 0) }));
  const thisMonth = byMonth.get(today.slice(0, 7)) ?? 0;
  const lastMonth = byMonth.get(months[10]) ?? 0;

  const productData: Datum[] = ((prod.data as { product_name: string; revenue: number; qty_sold: number }[] | null) ?? [])
    .map((r) => ({ label: r.product_name, value: Number(r.revenue) || 0, hint: `${Number(r.qty_sold)} ${t(locale, "sold")}` }));
  const labData: Datum[] = ((labs.data as { lab_id: string; lab_name: string; total_billed: number }[] | null) ?? [])
    .map((r) => ({ label: r.lab_name, value: Number(r.total_billed) || 0, href: `/labs/${r.lab_id}` }));
  const agingRows = (aging.data as { outstanding: number; bucket: string }[] | null) ?? [];
  const agingData: Datum[] = BUCKETS.map((b) => ({
    label: t(locale, b === "current" ? "Not yet due" : `${b} days`),
    value: agingRows.filter((r) => r.bucket === b).reduce((s, r) => s + Number(r.outstanding || 0), 0),
  }));
  const owed = agingData.reduce((s, d) => s + d.value, 0);
  const expiring = ((kits.data as { days_until_expiry: number }[] | null) ?? []);
  const expiringSoon = expiring.filter((k) => Number(k.days_until_expiry) <= 30).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Insights")}</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4" data-testid="insight-tiles">
        <StatCard label={t(locale, "Sales this month")} value={money(thisMonth)} hint={`${t(locale, "Last month")}: ${money(lastMonth)}`} />
        <StatCard label={t(locale, "Sales in 12 months")} value={money(monthData.reduce((s, d) => s + d.value, 0))} />
        <StatCard label={t(locale, "Owed to the company")} value={money(owed)} accent={owed > 0 ? "amber" : "green"} />
        <StatCard label={t(locale, "Kit batches expiring in 30 days")} value={String(expiringSoon)} hint={`${t(locale, "within 90 days")}: ${expiring.length}`} accent={expiringSoon ? "red" : "green"} />
      </div>

      <Panel title={t(locale, "Sales by month")}>
        <div data-testid="chart-months"><Columns data={monthData} format={compact} empty={t(locale, "No sales in the last 12 months")} /></div>
        <AsTable data={monthData} format={money} label={t(locale, "Show as a table")} head={[t(locale, "Month"), t(locale, "Sales")]} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title={t(locale, "Best-selling products")}>
          <div data-testid="chart-products"><BarList data={productData} format={money} empty={t(locale, "No sales yet")} /></div>
          <AsTable data={productData} format={money} label={t(locale, "Show as a table")} head={[t(locale, "Product"), t(locale, "Revenue")]} />
        </Panel>
        <Panel title={t(locale, "Biggest customers")}>
          <div data-testid="chart-labs"><BarList data={labData} format={money} empty={t(locale, "No sales yet")} /></div>
          <AsTable data={labData} format={money} label={t(locale, "Show as a table")} head={[t(locale, "Lab"), t(locale, "Billed")]} />
        </Panel>
      </div>

      <Panel title={t(locale, "What is owed, by age")}>
        <div data-testid="chart-aging"><BarList data={agingData} format={money} empty={t(locale, "Nothing is owed")} /></div>
        <AsTable data={agingData} format={money} label={t(locale, "Show as a table")} head={[t(locale, "Age"), t(locale, "Outstanding")]} />
      </Panel>
    </div>
  );
}
