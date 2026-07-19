import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  item_code: string;
  product_name: string;
  lab_name: string | null;
  price_list: string;
  rate: number;
  currency: string;
  selling: boolean;
  buying: boolean;
  valid_from: string | null;
  valid_upto: string | null;
}

export default async function PricesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("v_item_prices")
    .select("id, item_code, product_name, lab_name, price_list, rate, currency, selling, buying, valid_from, valid_upto")
    .order("product_name");
  const rows = (data as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Item Prices")}</h1>
        <Link href="/prices/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          + New price
        </Link>
      </div>
      <Panel title={`${t(locale, "Price list")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No item prices — labs fall back to the product default sell price")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Product")}</th>
                  <th className="px-4 py-2">{t(locale, "Price list")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Rate")}</th>
                  <th className="px-4 py-2">{t(locale, "For")}</th>
                  <th className="px-4 py-2">{t(locale, "Valid")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium">{r.product_name}<span className="ml-1 text-xs text-ink-gray-4">{r.item_code}</span></td>
                    <td className="px-4 py-2">{r.price_list}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.lab_name ?? "— all —"}</td>
                    <td className="px-4 py-2 font-medium">{Number(r.rate).toLocaleString()} {r.currency}</td>
                    <td className="px-4 py-2">
                      {r.selling && <span className="mr-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700">selling</span>}
                      {r.buying && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">buying</span>}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {r.valid_from ?? "—"}{r.valid_upto ? ` → ${r.valid_upto}` : ""}
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
