import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { ListShell } from "@/components/desk/ListShell";
import { Indicator } from "@/components/desk/Indicator";
import { submitPurchaseReceiptForm, cancelPurchaseReceiptForm } from "@/app/actions/purchase_receipt";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  receipt_no: string;
  posting_date: string;
  status: string;
  notes: string | null;
  companies: { name: string } | null;
  purchase_receipt_items: { id: string; qty: number; rate: number }[];
}

export default async function PurchaseReceiptsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("purchase_receipts")
    .select("id, receipt_no, posting_date, status, notes, companies:supplier_id(name), purchase_receipt_items(id, qty, rate)")
    .order("posting_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const draft = rows.filter((r) => r.status === "draft");
  const received = rows.filter((r) => r.status === "received");
  const lineValue = (r: Row) => (r.purchase_receipt_items ?? []).reduce((s, l) => s + Number(l.qty) * Number(l.rate), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Draft")} value={String(draft.length)} accent="amber" />
        <StatCard label={t(locale, "Received")} value={String(received.length)} accent="green" />
        <StatCard label={t(locale, "Total")} value={String(rows.length)} accent="brand" />
      </div>

      <ListShell
        title={t(locale, "Purchase Receipts")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Buying") }]}
        count={rows.length}
        newHref="/purchase-receipts/new"
        newLabel={t(locale, "New receipt")}
        actions={<Link href="/purchase-orders" className="rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">Purchase orders</Link>}
        filterPlaceholder="Filter by receipt / supplier…"
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No purchase receipts yet — receive kits/devices into stock")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Receipt no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Supplier")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2 text-right">{t(locale, "Items")}</th>
                  <th className="px-4 py-2 text-right">{t(locale, "Value")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-gray-1">
                    <td className="px-4 py-2 font-medium">{r.receipt_no}</td>
                    <td className="px-4 py-2">{r.companies?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{r.posting_date}</td>
                    <td className="px-4 py-2 text-right text-ink-gray-5">{r.purchase_receipt_items?.length ?? 0}</td>
                    <td className="px-4 py-2 text-right">{lineValue(r).toLocaleString()}</td>
                    <td className="px-4 py-2"><Indicator status={r.status} /></td>
                    <td className="px-4 py-2">
                      {r.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitPurchaseReceiptForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">Receive</button>
                          </form>
                          <form action={cancelPurchaseReceiptForm}>
                            <input type="hidden" name="id" value={r.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">Cancel</button>
                          </form>
                        </div>
                      ) : (
                        <span className="text-xs text-ink-gray-4">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ListShell>
    </div>
  );
}
