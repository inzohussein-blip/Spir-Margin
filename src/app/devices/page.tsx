import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { EmptyRow } from "@/components/dashboard/Panel";
import { ListShell } from "@/components/desk/ListShell";
import { Indicator } from "@/components/desk/Indicator";

export const dynamic = "force-dynamic";

interface DeviceRow {
  id: string;
  asset_code: string;
  serial_no: string | null;
  status: string;
  next_maintenance_date: string | null;
  products: { name: string } | null;
  labs: { name: string } | null;
}

export default async function DevicesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("devices")
    .select(
      "id, asset_code, serial_no, status, next_maintenance_date, products(name), labs(name)"
    )
    .order("asset_code");
  const devices = (data as unknown as DeviceRow[]) ?? [];

  return (
    <ListShell
      title={t(locale, "Devices")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Assets") }]}
      count={devices.length}
      newHref="/devices/new"
      newLabel={t(locale, "New device")}
    >
      {devices.length === 0 ? (
        <EmptyRow text={t(locale, "No devices yet")} />
      ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Asset code")}</th>
                  <th className="px-4 py-2">{t(locale, "Product")}</th>
                  <th className="px-4 py-2">{t(locale, "Serial")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Next maintenance")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-2 font-medium">{d.asset_code}</td>
                    <td className="px-4 py-2">{d.products?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {d.serial_no ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {d.labs?.name ?? "unassigned"}
                    </td>
                    <td className="px-4 py-2"><Indicator status={d.status} /></td>
                    <td className="px-4 py-2 text-ink-gray-5">
                      {d.next_maintenance_date ?? "—"}
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
