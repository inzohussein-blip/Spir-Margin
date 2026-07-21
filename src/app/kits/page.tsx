import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { EmptyRow } from "@/components/dashboard/Panel";
import { ListShell } from "@/components/desk/ListShell";

export const dynamic = "force-dynamic";

interface KitRow {
  id: string;
  batch_no: string;
  expiry_date: string | null;
  qty_available: number;
  buy_price: number;
  sell_price: number;
  products: { name: string } | null;
  warehouses: { name: string } | null;
}

export default async function KitsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("kit_batches")
    .select(
      "id, batch_no, expiry_date, qty_available, buy_price, sell_price, products(name), warehouses(name)"
    )
    .order("expiry_date");
  const kits = (data as unknown as KitRow[]) ?? [];

  const linkCls = "rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1";
  return (
    <ListShell
      title={t(locale, "Reagent Kits")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Stock") }]}
      count={kits.length}
      newHref="/kits/new"
      newLabel={t(locale, "New batch")}
      actions={
        <>
          <Link href="/delivery-notes" className={linkCls}>{t(locale, "Delivery notes")}</Link>
          <Link href="/stock-reconciliation" className={linkCls}>{t(locale, "Stock count")}</Link>
          <Link href="/kits/withdraw" className="rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-blue-50">{t(locale, "Record withdrawal")}</Link>
        </>
      }
    >
      {kits.length === 0 ? (
        <EmptyRow text={t(locale, "No kit batches yet")} />
      ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Batch")}</th>
                  <th className="px-4 py-2">{t(locale, "Product")}</th>
                  <th className="px-4 py-2">{t(locale, "Warehouse")}</th>
                  <th className="px-4 py-2">{t(locale, "Qty")}</th>
                  <th className="px-4 py-2">{t(locale, "Buy")}</th>
                  <th className="px-4 py-2">{t(locale, "Sell")}</th>
                  <th className="px-4 py-2">{t(locale, "Margin")}</th>
                  <th className="px-4 py-2">{t(locale, "Expiry")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {kits.map((k) => {
                  const margin = Number(k.sell_price) - Number(k.buy_price);
                  return (
                    <tr key={k.id}>
                      <td className="px-4 py-2 font-medium">{k.batch_no}</td>
                      <td className="px-4 py-2">{k.products?.name ?? "—"}</td>
                      <td className="px-4 py-2 text-ink-gray-5">
                        {k.warehouses?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2">{Number(k.qty_available)}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{k.buy_price}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{k.sell_price}</td>
                      <td className="px-4 py-2 font-medium text-emerald-600">
                        +{margin}
                      </td>
                      <td className="px-4 py-2 text-ink-gray-5">
                        {k.expiry_date ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
    </ListShell>
  );
}
