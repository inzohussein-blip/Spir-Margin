import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  serial_no: string;
  status: string;
  maintenance_status: string | null;
  warranty_expiry_date: string | null;
  products: { name: string } | null;
  labs: { name: string } | null;
}

const statusBadge: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700",
  inactive: "bg-surface-gray-2 text-ink-gray-6",
  consumed: "bg-amber-100 text-amber-700",
  delivered: "bg-blue-100 text-blue-700",
  expired: "bg-red-100 text-red-700",
};

export default async function SerialsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("serial_numbers")
    .select("id, serial_no, status, maintenance_status, warranty_expiry_date, products(name), labs(name)")
    .order("serial_no");
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Serial Numbers")}</h1>
        <Link href="/serials/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
          + New serial
        </Link>
      </div>
      <Panel title={`${t(locale, "All Serials")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No serial numbers — track individual serialized units here")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Serial")}</th>
                  <th className="px-4 py-2">{t(locale, "Product")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Warranty")}</th>
                  <th className="px-4 py-2">{t(locale, "Expiry")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 font-medium"><Link href={`/serials/${s.id}`} className="text-brand hover:underline">{s.serial_no}</Link></td>
                    <td className="px-4 py-2">{s.products?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{s.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[s.status] ?? "bg-surface-gray-2"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{s.maintenance_status?.replace(/_/g, " ") ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{s.warranty_expiry_date ?? "—"}</td>
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
