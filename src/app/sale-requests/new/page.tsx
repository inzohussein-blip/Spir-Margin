import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SaleRequestForm } from "@/components/shortcuts/SaleRequestForm";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { copySaleRequest } from "@/lib/copy-docs";

export const dynamic = "force-dynamic";

export default async function NewSaleRequestPage({ searchParams }: { searchParams: { from?: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const copied = searchParams.from ? await copySaleRequest(searchParams.from) : null;
  const [labsRes, productsRes] = await Promise.all([
    supabase.from("labs").select("id, name, code").order("name"),
    supabase.from("products").select("id, name, item_code, default_sell_price").order("name"),
  ]);

  const labs = ((labsRes.data as { id: string; name: string; code: string }[]) ?? []).map((l) => ({
    id: l.id,
    label: `${l.name} (${l.code})`,
  }));
  const products = (
    (productsRes.data as { id: string; name: string; item_code: string; default_sell_price: number | null }[]) ?? []
  ).map((p) => ({ id: p.id, label: `${p.name} (${p.item_code})`, sell: Number(p.default_sell_price ?? 0) }));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-gray-5">
        <Link href="/sale-requests" className="hover:text-brand">
          <span aria-hidden>→</span> {t(locale, "Sales requests")}
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "New sales request")}</h1>
      <SaleRequestForm labs={labs} products={products} defaults={copied ?? undefined} />
    </div>
  );
}
