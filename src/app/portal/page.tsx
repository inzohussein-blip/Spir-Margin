import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PortalShell } from "@/components/portal/PortalShell";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { getLocale } from "@/lib/i18n-server";
import { t, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Device { id: string; asset_code: string; serial_no: string | null; status: string; next_maintenance_date: string | null; products: { name: string } | null; }
interface Visit { id: string; visit_no: string; visit_date: string; maintenance_type: string; completion_status: string; service_person: string | null; }

export default async function PortalHomePage() {
  const locale = getLocale() as Locale;
  const user = await getCurrentUser();
  // Hard server-side guard: portal is customer-only and must be lab-bound.
  if (!user || user.role !== "customer" || !user.lab_id) redirect("/login");
  const labId = user.lab_id;

  const supabase = createClient();
  const [{ data: labData }, { data: devData }, { data: visitData }] = await Promise.all([
    supabase.from("labs").select("name").eq("id", labId).single(),
    supabase.from("devices").select("id, asset_code, serial_no, status, next_maintenance_date, products(name)").eq("lab_id", labId).order("asset_code"),
    supabase.from("maintenance_visits").select("id, visit_no, visit_date, maintenance_type, completion_status, service_person").eq("lab_id", labId).neq("status", "cancelled").order("visit_date", { ascending: false }).limit(50),
  ]);
  const labName = (labData as { name: string } | null)?.name ?? "";
  const devices = (devData as unknown as Device[]) ?? [];
  const visits = (visitData as unknown as Visit[]) ?? [];

  return (
    <PortalShell labName={labName} active="devices">
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-ink-gray-8">{t(locale, "Welcome")}, {labName}</h1>

        <Panel title={`${t(locale, "My devices")} (${devices.length})`}>
          {devices.length === 0 ? (
            <EmptyRow text={t(locale, "No devices on record.")} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Asset code")}</th>
                  <th className="px-4 py-2">{t(locale, "Product")}</th>
                  <th className="px-4 py-2">{t(locale, "Serial no")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Next maintenance date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {devices.map((d) => (
                  <tr key={d.id} className="hover:bg-surface-gray-1">
                    <td className="px-4 py-2 font-medium">{d.asset_code}</td>
                    <td className="px-4 py-2">{d.products?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{d.serial_no ?? "—"}</td>
                    <td className="px-4 py-2"><Indicator status={d.status} locale={locale} /></td>
                    <td className="px-4 py-2 text-ink-gray-5">{d.next_maintenance_date ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>

        <Panel title={`${t(locale, "Maintenance history")} (${visits.length})`}>
          {visits.length === 0 ? (
            <EmptyRow text={t(locale, "No maintenance visits yet.")} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Visit no")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Type")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Technician")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {visits.map((v) => (
                  <tr key={v.id} className="hover:bg-surface-gray-1">
                    <td className="px-4 py-2 font-medium">{v.visit_no}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{v.visit_date}</td>
                    <td className="px-4 py-2">{t(locale, v.maintenance_type)}</td>
                    <td className="px-4 py-2"><Indicator status={v.completion_status} locale={locale} /></td>
                    <td className="px-4 py-2 text-ink-gray-5">{v.service_person ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </PortalShell>
  );
}
