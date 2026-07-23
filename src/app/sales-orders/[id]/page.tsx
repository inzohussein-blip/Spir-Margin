import { RecordDetail } from "@/components/desk/RecordDetail";
import { Panel } from "@/components/dashboard/Panel";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Line {
  qty: number; rate: number;
  products: { default_buy_price: number | null } | null;
}

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);

/** Internal profit summary — the "sales detail" that isn't printed on the receipt. */
async function ProfitSummary({ id }: { id: string }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_order_items")
    .select("qty, rate, products(default_buy_price)")
    .eq("sales_order_id", id);
  const lines = (data as unknown as Line[]) ?? [];
  const revenue = lines.reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);
  const cost = lines.reduce((s, l) => s + Number(l.qty) * Number(l.products?.default_buy_price ?? 0), 0);
  const profit = revenue - cost;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

  const cells: { label: string; value: string; accent?: string }[] = [
    { label: t(locale, "Total revenue"), value: money(revenue) },
    { label: t(locale, "Total cost"), value: money(cost) },
    { label: t(locale, "Total profit"), value: money(profit), accent: profit >= 0 ? "text-emerald-600" : "text-red-600" },
    { label: t(locale, "Margin %"), value: `${margin.toFixed(1)}%`, accent: profit >= 0 ? "text-emerald-600" : "text-red-600" },
  ];

  return (
    <Panel title={t(locale, "Profit summary")}>
      <div className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
        {cells.map((c) => (
          <div key={c.label} className="rounded-xl border border-outline-gray-2 bg-surface-gray-1/40 p-3">
            <dt className="text-xs text-ink-gray-4">{c.label}</dt>
            <dd className={`mt-0.5 text-lg font-bold tabular-nums ${c.accent ?? "text-ink-gray-8"}`}>{c.value}</dd>
          </div>
        ))}
      </div>
      <p className="px-4 pb-3 text-xs text-ink-gray-4">
        {t(locale, "Estimated from current product costs — internal, not shown on the printed receipt.")}
      </p>
    </Panel>
  );
}

export default async function Page({ params }: { params: { id: string } }) {
  return (
    <RecordDetail
      table="sales_orders"
      id={params.id}
      listHref="/sales-orders"
      listLabel="Sales Orders"
      printHref={`/sales-orders/${params.id}/print`}
      extra={<ProfitSummary id={params.id} />}
    />
  );
}
