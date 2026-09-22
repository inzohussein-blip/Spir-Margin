import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { getLocale } from "@/lib/i18n-server";
import { fmtDate, fmtNum } from "@/lib/format";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string; request_no: string; request_date: string; status: string;
  customer_name: string | null; currency: string; discount: number;
  labs: { name: string } | null;
}

const STATUS: Record<string, "active" | "pending" | "inactive"> = {
  confirmed: "active", delivered: "active", draft: "pending", cancelled: "inactive",
};

export default async function SaleRequestsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("sale_requests")
    .select("id, request_no, request_date, status, customer_name, currency, discount, labs(name)")
    .order("request_date", { ascending: false })
    .limit(200);
  const rows = (data as unknown as Row[]) ?? [];

  const totals = await supabase.from("v_sale_request_totals").select("id, total");
  const totalById = new Map(
    ((totals.data as { id: string; total: number }[]) ?? []).map((r) => [r.id, Number(r.total)]),
  );

  return (
    <ListShell
      title={t(locale, "Sales requests")}
      count={rows.length}
      newHref="/sale-requests/new"
      newLabel={t(locale, "New sales request")}
    >
      {rows.length === 0 ? (
        <EmptyRow text={t(locale, "No sales requests yet.")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "Number")}</th>
                <th className="px-4 py-2">{t(locale, "Date")}</th>
                <th className="px-4 py-2">{t(locale, "Customer")}</th>
                <th className="px-4 py-2">{t(locale, "Status")}</th>
                <th className="px-4 py-2 text-end">{t(locale, "Total")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-gray-1">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/sale-requests/${r.id}`} className="text-brand hover:underline" dir="ltr">
                      {r.request_no}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">{fmtDate(r.request_date)}</td>
                  <td className="px-4 py-2">{r.labs?.name ?? r.customer_name ?? "—"}</td>
                  <td className="px-4 py-2">
                    <Indicator status={STATUS[r.status] ?? "pending"} label={t(locale, r.status)} />
                  </td>
                  <td className="px-4 py-2 text-end tabular-nums">
                    {fmtNum(totalById.get(r.id) ?? 0, { maximumFractionDigits: 2 })} {r.currency}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListShell>
  );
}
