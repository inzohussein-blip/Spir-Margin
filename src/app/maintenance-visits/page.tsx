import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { submitMaintenanceVisitForm, cancelMaintenanceVisitForm } from "@/app/actions/maintenance";

export const dynamic = "force-dynamic";

interface Row {
  id: string;
  visit_no: string;
  visit_date: string;
  maintenance_type: string;
  completion_status: string;
  status: string;
  service_person: string | null;
  labs: { name: string } | null;
  maintenance_visit_purposes: { id: string }[];
}

const statusBadge: Record<string, string> = {
  draft: "bg-surface-gray-2 text-ink-gray-6",
  submitted: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};
const typeBadge: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-700",
  unscheduled: "bg-amber-100 text-amber-700",
  breakdown: "bg-red-100 text-red-700",
};

export default async function MaintenanceVisitsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("maintenance_visits")
    .select("id, visit_no, visit_date, maintenance_type, completion_status, status, service_person, labs(name), maintenance_visit_purposes(id)")
    .order("visit_date", { ascending: false });
  const rows = (data as unknown as Row[]) ?? [];
  const draft = rows.filter((r) => r.status === "draft").length;
  const done = rows.filter((r) => r.status === "submitted").length;
  const breakdowns = rows.filter((r) => r.maintenance_type === "breakdown").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Maintenance Visits")}</h1>
        <div className="flex gap-2">
          <Link href="/devices" className="rounded-md border border-outline-gray-2 px-3 py-2 text-sm font-medium text-ink-gray-7 hover:bg-surface-gray-1">{t(locale, "Devices")}</Link>
          <Link href="/maintenance-visits/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ New visit</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Draft")} value={String(draft)} accent="amber" />
        <StatCard label={t(locale, "Completed")} value={String(done)} accent="green" />
        <StatCard label={t(locale, "Breakdowns")} value={String(breakdowns)} accent="brand" />
      </div>

      <Panel title={`${t(locale, "Visits")} (${rows.length})`}>
        {rows.length === 0 ? (
          <EmptyRow text={t(locale, "No maintenance visits yet — record a service call to a lab")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Visit no.")}</th>
                  <th className="px-4 py-2">{t(locale, "Lab")}</th>
                  <th className="px-4 py-2">{t(locale, "Date")}</th>
                  <th className="px-4 py-2">{t(locale, "Type")}</th>
                  <th className="px-4 py-2">{t(locale, "Devices")}</th>
                  <th className="px-4 py-2">{t(locale, "Person")}</th>
                  <th className="px-4 py-2">{t(locale, "Status")}</th>
                  <th className="px-4 py-2">{t(locale, "Action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {rows.map((v) => (
                  <tr key={v.id}>
                    <td className="px-4 py-2 font-medium"><Link href={`/maintenance-visits/${v.id}`} className="text-brand hover:underline">{v.visit_no}</Link></td>
                    <td className="px-4 py-2">{v.labs?.name ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{v.visit_date}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${typeBadge[v.maintenance_type] ?? "bg-surface-gray-2"}`}>
                        {v.maintenance_type}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-ink-gray-5">{v.maintenance_visit_purposes?.length ?? 0}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{v.service_person ?? "—"}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge[v.status] ?? "bg-surface-gray-2"}`}>
                        {v.status}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {v.status === "draft" ? (
                        <div className="flex gap-2">
                          <form action={submitMaintenanceVisitForm}>
                            <input type="hidden" name="id" value={v.id} />
                            <button className="rounded-md bg-brand px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-dark">{t(locale, "Submit")}</button>
                          </form>
                          <form action={cancelMaintenanceVisitForm}>
                            <input type="hidden" name="id" value={v.id} />
                            <button className="rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1">{t(locale, "Cancel")}</button>
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
      </Panel>
    </div>
  );
}
