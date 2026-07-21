import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { generateMaintenanceScheduleForm, cancelMaintenanceScheduleForm } from "@/app/actions/maintenance_schedule";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  schedule_no: string;
  periodicity: string;
  start_date: string;
  no_of_visits: number;
  status: string;
  devices: { asset_code: string; products: { name: string } | null } | null;
  labs: { name: string } | null;
  maintenance_schedule_details: { id: string; completion_status: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  active: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export default async function MaintenanceSchedulesPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("maintenance_schedules")
    .select("id, schedule_no, periodicity, start_date, no_of_visits, status, devices(asset_code, products(name)), labs(name), maintenance_schedule_details(id, completion_status)")
    .order("created_at", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Maintenance Schedules")}</h1>
        <div className="flex gap-2">
          <Link href="/maintenance-visits" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Visits")}</Link>
          <Link href="/maintenance-schedules/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New schedule</Link>
        </div>
      </div>

      <Panel title={`${t(locale, "Schedules")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No schedules yet — plan recurring preventive maintenance for a device")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Schedule no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Device")}</th>
                  <th className="px-4 py-2">{t(locale, "Periodicity")}</th>
                  <th className="px-4 py-2">{t(locale, "Start")}</th>
                  <th className="px-4 py-2">{t(locale, "Visits")}</th>
                  <th className="px-4 py-2">{t(locale, "Done")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((sc) => {
                  const done = sc.maintenance_schedule_details?.filter((d) => d.completion_status === "done").length ?? 0;
                  const planned = sc.maintenance_schedule_details?.length ?? 0;
                  return (
                    <tr key={sc.id}>
                      <td className="px-4 py-2 font-medium"><Link href={`/maintenance-schedules/${sc.id}`} className="text-brand hover:underline">{sc.schedule_no}</Link></td>
                      <td className="px-4 py-2">
                        {sc.devices?.asset_code ?? "—"}
                        {sc.devices?.products?.name ? <span className="text-ink-gray-4"> · {sc.devices.products.name}</span> : null}
                      </td>
                      <td className="px-4 py-2 text-ink-gray-5">{sc.periodicity.replace("_", " ")}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{sc.start_date}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{sc.no_of_visits}</td>
                      <td className="px-4 py-2 text-ink-gray-5">{done}/{planned}</td>
                      <td className="px-4 py-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[sc.status] ?? "bg-surface-gray-2"}`}>
                          {sc.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        {sc.status !== "cancelled" ? (
                          <div className="flex gap-2">
                            <form action={generateMaintenanceScheduleForm}>
                              <input type="hidden" name="id" value={sc.id} />
                              <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{planned > 0 ? "Regenerate" : "Generate"}</button>
                            </form>
                            <form action={cancelMaintenanceScheduleForm}>
                              <input type="hidden" name="id" value={sc.id} />
                              <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-gray-4">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
