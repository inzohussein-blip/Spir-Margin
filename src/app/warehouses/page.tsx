import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";

export const dynamic = "force-dynamic";

interface WarehouseRow {
  id: string;
  name: string;
  warehouse_type: string | null;
  city: string | null;
  phone: string | null;
  is_disabled: boolean;
}

export default async function WarehousesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("warehouses")
    .select("id, name, warehouse_type, city, phone, is_disabled")
    .order("name");
  const rows = (data as WarehouseRow[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Warehouses")}</h1>
        <Link
          href="/warehouses/new"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          + New warehouse
        </Link>
      </div>
      <Panel title={`${t(locale, "All Warehouses")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No warehouses yet")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Name")}</th>
                  <th className="px-4 py-2">{t(locale, "Type")}</th>
                  <th className="px-4 py-2">{t(locale, "City")}</th>
                  <th className="px-4 py-2">{t(locale, "Phone")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((w) => (
                  <tr key={w.id} className={w.is_disabled ? "opacity-50" : ""}>
                    <td className="px-4 py-2 font-medium">{w.name}</td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {w.warehouse_type ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{w.city ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{w.phone ?? "—"}</td>
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
