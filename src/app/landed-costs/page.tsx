import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { applyLandedCostForm } from "@/app/actions/landed_cost";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

interface Row {
  id: string;
  voucher_no: string;
  total_extra: number;
  allocation_method: string;
  status: string;
  created_at: string;
  purchase_receipts: { receipt_no: string } | null;
}

export default async function LandedCostsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("landed_cost_vouchers")
    .select("id, voucher_no, total_extra, allocation_method, status, created_at, purchase_receipts(receipt_no)")
    .order("created_at", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <ListShell
      title={t(locale, "Landed Costs")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Buying") }]}
      count={rows.length}
      newHref="/landed-costs/new"
      newLabel={t(locale, "New landed cost")}
      filterPlaceholder={t(locale, "Filter by voucher / receipt…")}
    >
      {rows.length === 0 ? (
        <EmptyRow text={t(locale, "No landed-cost vouchers yet.")} />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-ink-gray-4">
              <th className="px-4 py-2">{t(locale, "Voucher")}</th>
              <th className="px-4 py-2">{t(locale, "Receipt")}</th>
              <th className="px-4 py-2">{t(locale, "Allocation")}</th>
              <th className="px-4 py-2 text-end">{t(locale, "Extra cost")}</th>
              <th className="px-4 py-2">{t(locale, "Status")}</th>
              <th className="px-4 py-2 text-end">{t(locale, "Action")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-gray-1">
            {rows.map((r) => (
              <tr key={r.id} className="hover:bg-surface-gray-1">
                <td className="px-4 py-2 font-medium">{r.voucher_no}</td>
                <td className="px-4 py-2 text-ink-gray-5">{r.purchase_receipts?.receipt_no ?? "—"}</td>
                <td className="px-4 py-2 text-ink-gray-5">
                  {t(locale, r.allocation_method === "by_qty" ? "By quantity" : "By value")}
                </td>
                <td className="px-4 py-2 text-end font-semibold">{money(Number(r.total_extra))}</td>
                <td className="px-4 py-2"><Indicator status={r.status} locale={locale} /></td>
                <td className="px-4 py-2 text-end">
                  {r.status === "draft" ? (
                    <form action={applyLandedCostForm}>
                      <input type="hidden" name="id" value={r.id} />
                      <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">
                        {t(locale, "Apply")}
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs text-ink-gray-4">{t(locale, "Applied")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </ListShell>
  );
}
