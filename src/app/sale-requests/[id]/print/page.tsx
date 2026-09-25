import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentSheet } from "@/components/print/DocumentSheet";
import { getLocale } from "@/lib/i18n-server";
import { fmtDate, fmtNum } from "@/lib/format";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Req {
  id: string; request_no: string; request_date: string; status: string;
  customer_name: string | null; customer_phone: string | null;
  currency: string; discount: number; notes: string | null; created_by: string | null;
  labs: { name: string; city: string | null; phone: string | null; address: string | null } | null;
}
interface Item { description: string; qty: number; rate: number; amount: number; line_no: number; }

/** The receipt handed to the customer — company letterhead, lines, total. */
export default async function SaleRequestReceipt({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("sale_requests")
    .select("id, request_no, request_date, status, customer_name, customer_phone, currency, discount, notes, created_by, labs(name, city, phone, address)")
    .eq("id", params.id)
    .single();
  const req = data as unknown as Req | null;
  if (!req) notFound();

  const { data: itemRows } = await supabase
    .from("sale_request_items")
    .select("description, qty, rate, amount, line_no")
    .eq("request_id", req.id)
    .order("line_no");
  const items = (itemRows as unknown as Item[]) ?? [];

  const subtotal = items.reduce((s, i) => s + Number(i.amount), 0);
  const discount = Number(req.discount);

  return (
    <DocumentSheet
      whatsappPhone={req.labs?.phone ?? req.customer_phone}
      docType={t(locale, "Receipt")}
      docNo={req.request_no}
      date={fmtDate(req.request_date)}
      backHref={`/sale-requests/${req.id}`}
      currency={req.currency}
      parties={[
        {
          heading: t(locale, "Customer"),
          name: req.labs?.name ?? req.customer_name ?? "—",
          lines: [
            req.labs?.address ?? null,
            req.labs?.city ?? null,
            req.labs?.phone ?? req.customer_phone ?? null,
          ],
        },
        {
          heading: t(locale, "Status"),
          name: t(locale, req.status),
          lines: [req.created_by ? `${t(locale, "Issued by")}: ${req.created_by}` : null],
        },
      ]}
      lines={items.map((i) => ({
        label: i.description,
        qty: Number(i.qty),
        rate: Number(i.rate),
        amount: Number(i.amount),
      }))}
      totals={[
        { label: t(locale, "Subtotal"), value: subtotal },
        ...(discount > 0 ? [{ label: t(locale, "Discount"), value: -discount }] : []),
        { label: t(locale, "Total"), value: Math.max(subtotal - discount, 0), strong: true },
      ]}
      meta={[
        { label: t(locale, "Lines"), value: fmtNum(items.length) },
        { label: t(locale, "Date"), value: fmtDate(req.request_date) },
        { label: t(locale, "Number"), value: <span dir="ltr">{req.request_no}</span> },
      ]}
      notes={req.notes}
    />
  );
}
