import Link from "next/link";
import { getWarehouses, getKitBatches } from "@/lib/queries";
import { StockEntryForm } from "@/components/stock/StockEntryForm";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

export default async function NewStockEntryPage() {
  const locale = getLocale();
  const [warehouses, batches] = await Promise.all([getWarehouses(), getKitBatches()]);
  const warehouseOpts = warehouses.map((w) => ({ id: w.id as string, label: w.name as string }));
  const batchOpts = batches.map((b) => {
    const prod = (b as { products?: { name?: string } | null }).products;
    return {
      id: b.id as string,
      label: `${b.batch_no as string}${prod?.name ? ` · ${prod.name}` : ""} (avail ${Number(b.qty_available)})`,
      avail: Number(b.qty_available),
    };
  });

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/stock-entries" className="hover:text-brand">← {t(locale, "Stock entries")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New Stock Entry")}</h1>
      <StockEntryForm warehouses={warehouseOpts} batches={batchOpts} />
    </div>
  );
}
