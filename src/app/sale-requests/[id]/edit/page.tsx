import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SaleRequestForm } from "@/components/shortcuts/SaleRequestForm";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Req {
  id: string; request_no: string; request_date: string; status: string;
  lab_id: string | null; customer_name: string | null; customer_phone: string | null;
  currency: string; discount: number; notes: string | null;
}
interface Item { product_id: string | null; description: string; qty: number; rate: number; line_no: number; }

export default async function EditSaleRequestPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();

  const { data } = await supabase
    .from("sale_requests")
    .select("id, request_no, request_date, status, lab_id, customer_name, customer_phone, currency, discount, notes")
    .eq("id", params.id)
    .single();
  const req = data as unknown as Req | null;
  if (!req) notFound();
  // A confirmed request has already been handed over as a receipt; changing
  // it would leave the paper and the record disagreeing.
  if (req.status !== "draft") redirect(`/sale-requests/${req.id}`);

  const [itemsRes, labsRes, productsRes] = await Promise.all([
    supabase.from("sale_request_items").select("product_id, description, qty, rate, line_no").eq("request_id", req.id).order("line_no"),
    supabase.from("labs").select("id, name, code").order("name"),
    supabase.from("products").select("id, name, item_code, default_sell_price").order("name"),
  ]);

  const items = (itemsRes.data as unknown as Item[]) ?? [];
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
        <Link href={`/sale-requests/${req.id}`} className="hover:text-brand">
          <span aria-hidden>→</span> <span dir="ltr">{req.request_no}</span>
        </Link>
      </div>
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Edit the request")}</h1>
      <SaleRequestForm
        labs={labs}
        products={products}
        requestId={req.id}
        defaults={{
          lab_id: req.lab_id ?? "",
          customer_name: req.customer_name ?? "",
          customer_phone: req.customer_phone ?? "",
          request_date: req.request_date,
          currency: req.currency,
          discount: Number(req.discount),
          notes: req.notes ?? "",
          items: items.length
            ? items.map((i) => ({
                product_id: i.product_id ?? "",
                description: i.description,
                qty: Number(i.qty),
                rate: Number(i.rate),
              }))
            : [{ product_id: "", description: "", qty: 1, rate: 0 }],
        }}
      />
    </div>
  );
}
