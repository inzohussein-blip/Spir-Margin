import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const money = (n: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Product {
  id: string; item_code: string; name: string; product_type: string;
  brand: string | null; uom: string; default_buy_price: number; default_sell_price: number;
}
interface Batch { id: string; batch_no: string; qty_available: number; expiry_date: string | null; warehouses: { name: string } | null; }

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data: pData } = await supabase
    .from("products").select("id, item_code, name, product_type, brand, uom, default_buy_price, default_sell_price").eq("id", params.id).single();
  const p = pData as unknown as Product | null;
  if (!p) notFound();

  const [{ data: batchData }, { data: salesData }] = await Promise.all([
    supabase.from("kit_batches").select("id, batch_no, qty_available, expiry_date, warehouses(name)").eq("product_id", params.id).order("expiry_date"),
    supabase.from("v_sales_by_product").select("qty_sold, revenue").eq("product_id", params.id),
  ]);
  const batches = ((batchData as unknown as Batch[]) ?? []).filter((b) => Number(b.qty_available) > 0);
  const inStock = batches.reduce((s, b) => s + Number(b.qty_available), 0);
  const sold = (salesData as unknown as { qty_sold: number; revenue: number }[])?.[0];

  const info: [string, string][] = [
    [t(locale, "Item code"), p.item_code],
    [t(locale, "Type"), p.product_type.replace(/_/g, " ")],
    [t(locale, "Brand"), p.brand || "—"],
    [t(locale, "Unit"), p.uom],
    [t(locale, "Buy price"), money(Number(p.default_buy_price))],
    [t(locale, "Sell price"), money(Number(p.default_sell_price))],
  ];

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-gray-5"><Link href="/products" className="hover:text-brand">← {t(locale, "Products")}</Link></div>
      <div>
        <h1 className="text-2xl font-bold text-ink-gray-8">{p.name}</h1>
        <p className="text-sm text-ink-gray-5">{p.item_code}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "In stock")} value={`${inStock}`} hint={`${batches.length} ${t(locale, "Batches")}`} accent="brand" />
        <StatCard label={t(locale, "Sell price")} value={money(Number(p.default_sell_price))} accent="green" />
        <StatCard label={t(locale, "Total billed")} value={money(Number(sold?.revenue ?? 0))} hint={`${Number(sold?.qty_sold ?? 0)} ${t(locale, "Qty")}`} accent="amber" />
      </div>

      <Panel title={t(locale, "Details")}>
        <dl className="grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-3">
          {info.map(([k, v]) => (<div key={k}><dt className="text-ink-gray-4">{k}</dt><dd className="font-medium capitalize text-ink-gray-8">{v}</dd></div>))}
        </dl>
      </Panel>

      <Panel title={`${t(locale, "Stock batches")} (${batches.length})`}>
        {batches.length === 0 ? <EmptyRow text={t(locale, "No stock on hand")} /> : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">{t(locale, "Batches")}</th><th className="px-4 py-2">{t(locale, "Warehouses")}</th>
              <th className="px-4 py-2 text-end">{t(locale, "Qty")}</th><th className="px-4 py-2">{t(locale, "Expiry")}</th>
            </tr></thead>
            <tbody className="divide-y divide-outline-gray-1">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-surface-gray-1">
                  <td className="px-4 py-2 font-medium">{b.batch_no}</td>
                  <td className="px-4 py-2 text-ink-gray-5">{b.warehouses?.name ?? "—"}</td>
                  <td className="px-4 py-2 text-end">{Number(b.qty_available)}</td>
                  <td className="px-4 py-2 text-ink-gray-5">{b.expiry_date ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
