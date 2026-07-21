import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { rfqToQuotationForm } from "@/app/actions/rfq";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Item { id: string; qty: number; products: { name: string; item_code: string | null } | null; }
interface Supplier {
  id: string; quote_status: string; supplier_quotation_id: string | null;
  companies: { name: string } | null;
}
interface Rfq {
  id: string; rfq_no: string; transaction_date: string; schedule_date: string | null;
  status: string; message: string | null;
  rfq_items: Item[];
  rfq_suppliers: Supplier[];
}

export default async function RfqDetailPage({ params }: { params: { id: string } }) {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("rfqs")
    .select("id, rfq_no, transaction_date, schedule_date, status, message, rfq_items(id, qty, products(name, item_code)), rfq_suppliers(id, quote_status, supplier_quotation_id, companies:supplier_id(name))")
    .eq("id", params.id)
    .single();
  const rfq = data as unknown as Rfq | null;
  if (!rfq) notFound();

  return (
    <div className="space-y-6">
      <div className="text-sm text-ink-gray-5">
        <Link href="/rfqs" className="hover:text-brand">← Requests for quotation</Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-ink-gray-8">{rfq.rfq_no}</h1>
        <p className="text-sm text-ink-gray-5">
          {rfq.transaction_date}{rfq.schedule_date ? ` · reply by ${rfq.schedule_date}` : ""} · {rfq.status}
        </p>
        {rfq.message && <p className="mt-1 text-sm text-ink-gray-6">{rfq.message}</p>}
      </div>

      <Panel title={`${t(locale, "Items")} (${rfq.rfq_items?.length ?? 0})`}>
        {(rfq.rfq_items?.length ?? 0) === 0 ? (
          <EmptyRow text={t(locale, "No items")} />
        ) : (
          <ul className="divide-y divide-outline-gray-1">
            {rfq.rfq_items.map((it) => (
              <li key={it.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span>{it.products?.name ?? "—"}{it.products?.item_code ? ` (${it.products.item_code})` : ""}</span>
                <span className="text-ink-gray-5">qty {Number(it.qty)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={`${t(locale, "Suppliers")} (${rfq.rfq_suppliers?.length ?? 0})`}>
        {(rfq.rfq_suppliers?.length ?? 0) === 0 ? (
          <EmptyRow text={t(locale, "No suppliers")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Supplier")}</th>
                  <th className="px-4 py-2">{t(locale, "Quote status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rfq.rfq_suppliers.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium">{s.companies?.name ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.quote_status === "received" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                        {s.quote_status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {s.supplier_quotation_id ? (
                        <Link href="/supplier-quotations" className="text-xs text-brand hover:underline">view quotation</Link>
                      ) : (
                        <form action={rfqToQuotationForm} className="flex items-center gap-1">
                          <input type="hidden" name="rfq_supplier_id" value={s.id} />
                          <input type="hidden" name="rfq_id" value={rfq.id} />
                          <input name="quote_no" placeholder={t(locale, "quote no.")} className="w-28 rounded-md border border-outline-gray-2 px-2 py-1 text-xs" />
                          <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Record quote")}</button>
                        </form>
                      )}
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
