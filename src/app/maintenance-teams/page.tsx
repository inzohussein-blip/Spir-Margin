import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Member { id: string; member_name: string; role: string | null; }
interface Task { id: string; task_name: string; maintenance_type: string; periodicity: string | null; }
interface Row {
  id: string;
  name: string;
  manager_name: string | null;
  description: string | null;
  maintenance_team_members: Member[];
  maintenance_tasks: Task[];
}

export default async function MaintenanceTeamsPage() {
  const locale = getLocale();
  const supabase = createClient();
  const { data } = await supabase
    .from("maintenance_teams")
    .select("id, name, manager_name, description, maintenance_team_members(id, member_name, role), maintenance_tasks(id, task_name, maintenance_type, periodicity)")
    .order("name");
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Maintenance Teams")}</h1>
        <Link href="/maintenance-teams/new" className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">+ {t(locale, "New team")}</Link>
      </div>

      {rows.length === 0 ? (
        <Panel title={t(locale, "Teams")}><EmptyRow text={t(locale, "No maintenance teams yet")} /></Panel>
      ) : (
        rows.map((t) => (
          <Panel key={t.id} title={`${t.name}${t.manager_name ? ` · ${t.manager_name}` : ""}`}>
            {t.description && <p className="px-4 pt-3 text-sm text-ink-gray-6">{t.description}</p>}
            <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
              <div>
                <div className="mb-2 text-xs uppercase text-ink-gray-4">Members ({t.maintenance_team_members?.length ?? 0})</div>
                <ul className="space-y-1 text-sm">
                  {(t.maintenance_team_members ?? []).map((m) => (
                    <li key={m.id} className="flex justify-between">
                      <span className="text-ink-gray-8">{m.member_name}</span>
                      <span className="text-ink-gray-4">{m.role ?? "—"}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="mb-2 text-xs uppercase text-ink-gray-4">Tasks ({t.maintenance_tasks?.length ?? 0})</div>
                <ul className="space-y-1 text-sm">
                  {(t.maintenance_tasks ?? []).map((k) => (
                    <li key={k.id} className="flex justify-between">
                      <span className="text-ink-gray-8">{k.task_name}</span>
                      <span className="text-ink-gray-4">{k.maintenance_type}{k.periodicity ? ` · ${k.periodicity}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}
