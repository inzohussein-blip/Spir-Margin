import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getProducts, getLabs } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { QuotationForm } from "@/components/selling/QuotationForm";
import type { QuotationInput } from "@/app/actions/quotation";
import { t } from "@/lib/i18n";
import { getLocale } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

interface Item { product_id: string; qty: number; rate: number; }
interface Quotation {
  id: string; lab_id: string; status: string; transaction_date: string;
  valid_till: string | null; notes: string | null;
  quotation_items: Item[];
}

export default async function EditQuotationPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("quotations")
    .select("id, lab_id, status, transaction_date, valid_till, notes, quotation_items(product_id, qty, rate)")
    .eq("id", params.id)
    .single();
  const q = data as unknown as Quotation | null;
  if (!q) notFound();
  // A quotation that already became a sales order is locked.
  if (q.status === "ordered") redirect("/quotations");

  const [products, labs] = await Promise.all([getProducts(), getLabs()]);
  const defaults: QuotationInput = {
    lab_id: q.lab_id,
    transaction_date: q.transaction_date,
    valid_till: q.valid_till ?? "",
    notes: q.notes ?? "",
    items: (q.quotation_items ?? []).map((it) => ({
      product_id: it.product_id,
      qty: Number(it.qty),
      rate: Number(it.rate),
    })),
  };
  if (defaults.items.length === 0) defaults.items = [{ product_id: "", qty: 1, rate: 0 }];

  return (
    <div className="space-y-4">
      <div className="text-sm text-ink-gray-5">
        <Link href="/quotations" className="hover:text-brand">← {t(locale, "Quotations")}</Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Edit quotation")}</h1>
      <QuotationForm
        quotationId={q.id}
        defaults={defaults}
        labs={labs.map((l) => ({ id: l.id, label: `${l.name} (${l.code})` }))}
        products={products.map((p) => ({ id: p.id, label: `${p.name} (${p.item_code})`, sell: Number(p.default_sell_price) }))}
      />
    </div>
  );
}
