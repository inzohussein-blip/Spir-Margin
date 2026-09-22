import Link from "next/link";
import { notFound } from "next/navigation";
import { PrinterIcon, PencilIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Panel } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { setSaleRequestStatus } from "@/app/actions/sale_request";
import { getLocale } from "@/lib/i18n-server";
import { fmtDate, fmtNum } from "@/lib/format";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Req {
  id: string; request_no: string; request_date: string; status: string;
  customer_name: string | null; customer_phone: string | null;
  currency: string; discount: number; notes: string | null; created_by: string | null;
  labs: { name: string; city: string | null; phone: string | null } | null;
}
interface Item { id: string; description: string; qty: number; rate: number; amount: number; line_no: number; }

const NEXT: Record<string, string[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export default async function SaleRequestPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("sale_requests")
    .select("id, request_no, request_date, status, customer_name, customer_phone, currency, discount, notes, created_by, labs(name, city, phone)")
    .eq("id", params.id)
    .single();
  const req = data as unknown as Req | null;
  if (!req) notFound();

  const { data: itemRows } = await supabase
    .from("sale_request_items")
    .select("id, description, qty, rate, amount, line_no")
    .eq("request_id", req.id)
    .order("line_no");
  const items = (itemRows as unknown as Item[]) ?? [];

  const subtotal = items.reduce((s, i) => s + Number(i.amount), 0);
  const total = Math.max(subtotal - Number(req.discount), 0);
  const money = (n: number) => `${fmtNum(n, { maximumFractionDigits: 2 })} ${req.currency}`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2 text-sm text-ink-gray-5">
        <Link href="/sale-requests" className="hover:text-brand">
          <span aria-hidden>→</span> {t(locale, "Sales requests")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8" dir="ltr">{req.request_no}</h1>
          <p className="text-sm text-ink-gray-5">
            {fmtDate(req.request_date)} · {req.labs?.name ?? req.customer_name ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Indicator status={req.status === "cancelled" ? "inactive" : req.status === "draft" ? "pending" : "active"} label={t(locale, req.status)} />
          {req.status === "draft" ? (
            <Link
              href={`/sale-requests/${req.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand"
            >
              <PencilIcon size={15} /> {t(locale, "Edit")}
            </Link>
          ) : null}
          <Link
            href={`/sale-requests/${req.id}/print`}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
          >
            <PrinterIcon size={15} /> {t(locale, "Print the receipt")}
          </Link>
        </div>
      </div>

      {NEXT[req.status]?.length ? (
        <div className="flex flex-wrap gap-2">
          {NEXT[req.status].map((s) => (
            <form key={s} action={setSaleRequestStatus}>
              <input type="hidden" name="id" value={req.id} />
              <input type="hidden" name="status" value={s} />
              <button className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand">
                {t(locale, s === "confirmed" ? "Confirm" : s === "delivered" ? "Mark delivered" : "Cancel")}
              </button>
            </form>
          ))}
        </div>
      ) : null}

      <Panel title={t(locale, "Lines")}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "Description")}</th>
                <th className="px-4 py-2 text-end">{t(locale, "Qty")}</th>
                <th className="px-4 py-2 text-end">{t(locale, "Rate")}</th>
                <th className="px-4 py-2 text-end">{t(locale, "Amount")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2">{i.description}</td>
                  <td className="px-4 py-2 text-end tabular-nums">{fmtNum(i.qty, { maximumFractionDigits: 3 })}</td>
                  <td className="px-4 py-2 text-end tabular-nums">{money(Number(i.rate))}</td>
                  <td className="px-4 py-2 text-end tabular-nums">{money(Number(i.amount))}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-outline-gray-3">
              <tr><td colSpan={3} className="px-4 py-1.5 text-end text-ink-gray-5">{t(locale, "Subtotal")}</td><td className="px-4 py-1.5 text-end tabular-nums">{money(subtotal)}</td></tr>
              <tr><td colSpan={3} className="px-4 py-1.5 text-end text-ink-gray-5">{t(locale, "Discount")}</td><td className="px-4 py-1.5 text-end tabular-nums">{money(Number(req.discount))}</td></tr>
              <tr><td colSpan={3} className="px-4 py-1.5 text-end font-semibold">{t(locale, "Total")}</td><td className="px-4 py-1.5 text-end text-lg font-bold tabular-nums">{money(total)}</td></tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      {req.notes ? (
        <Panel title={t(locale, "Notes")}>
          <p className="whitespace-pre-line p-4 text-sm text-ink-gray-6">{req.notes}</p>
        </Panel>
      ) : null}
    </div>
  );
}
