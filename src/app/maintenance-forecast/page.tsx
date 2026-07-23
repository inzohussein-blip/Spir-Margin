import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  asset_code: string;
  product_name: string;
  lab_name: string | null;
  next_maintenance_date: string;
  days_until_due: number;
  urgency: "overdue" | "due_this_week" | "due_this_month" | "upcoming";
  last_visit_date: string | null;
}

const URGENCY: Record<string, { key: string; badge: string }> = {
  overdue: { key: "Overdue", badge: "bg-red-100 text-red-700" },
  due_this_week: { key: "Due this week", badge: "bg-amber-100 text-amber-700" },
  due_this_month: { key: "Due this month", badge: "bg-yellow-100 text-yellow-700" },
  upcoming: { key: "Upcoming", badge: "bg-surface-gray-2 text-ink-gray-6" },
};

export default async function MaintenanceForecastPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase.from("v_maintenance_forecast").select("*");
  const rows = (data as unknown as Row[]) ?? [];
  const overdue = rows.filter((r) => r.urgency === "overdue").length;
  const week = rows.filter((r) => r.urgency === "due_this_week").length;
  const month = rows.filter((r) => r.urgency === "due_this_month").length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Overdue")} value={String(overdue)} accent="red" />
        <StatCard label={t(locale, "Due this week")} value={String(week)} accent="amber" />
        <StatCard label={t(locale, "Due this month")} value={String(month)} accent="brand" />
      </div>

      <ListShell
        title={t(locale, "Maintenance Forecast")}
        breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Maintenance") }]}
        count={rows.length}
        filterPlaceholder={t(locale, "Filter by device / lab…")}
      >
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No devices need maintenance in the next 90 days.")} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "Asset code")}</th>
                <th className="px-4 py-2">{t(locale, "Product")}</th>
                <th className="px-4 py-2">{t(locale, "Lab")}</th>
                <th className="px-4 py-2">{t(locale, "Next maintenance date")}</th>
                <th className="px-4 py-2 text-end">{t(locale, "Days until due")}</th>
                <th className="px-4 py-2">{t(locale, "Last visit")}</th>
                <th className="px-4 py-2">{t(locale, "Urgency")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-gray-1">
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/devices/${r.id}`} className="text-brand hover:underline">{r.asset_code}</Link>
                  </td>
                  <td className="px-4 py-2">{r.product_name}</td>
                  <td className="px-4 py-2 text-ink-gray-5">{r.lab_name ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-gray-5">{r.next_maintenance_date}</td>
                  <td className={`px-4 py-2 text-end font-semibold ${Number(r.days_until_due) < 0 ? "text-red-600" : "text-ink-gray-7"}`}>
                    {Number(r.days_until_due)}
                  </td>
                  <td className="px-4 py-2 text-ink-gray-5">{r.last_visit_date ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${URGENCY[r.urgency].badge}`}>
                      {t(locale, URGENCY[r.urgency].key)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </ListShell>
    </div>
  );
}
