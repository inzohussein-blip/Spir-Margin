import { CheckCircle2Icon, XCircleIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { MonitoringUnauthorized } from "@/components/monitoring/Unauthorized";
import { SyncHealthLive } from "@/components/monitoring/SyncHealthLive";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Outage { id: number; user_email: string | null; went_offline_at: string; came_online_at: string; duration_seconds: number; }
interface Sync { id: number; synced_at: string; user_email: string | null; item_count: number; ok: boolean; detail: string | null; }

function human(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return rem ? `${m}m ${rem}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export default async function SyncHealthPage() {
  const locale = getLocale();
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return <MonitoringUnauthorized />;

  const supabase = createClient();
  const [outRes, syncRes] = await Promise.all([
    supabase.from("connectivity_events").select("id, user_email, went_offline_at, came_online_at, duration_seconds").order("came_online_at", { ascending: false }).limit(100),
    supabase.from("sync_events").select("id, synced_at, user_email, item_count, ok, detail").order("synced_at", { ascending: false }).limit(100),
  ]);
  const outages = (outRes.data as unknown as Outage[]) ?? [];
  const syncs = (syncRes.data as unknown as Sync[]) ?? [];

  const totalDowntime = outages.reduce((s, o) => s + Number(o.duration_seconds), 0);
  const lastSync = syncs[0]?.synced_at ? new Date(syncs[0].synced_at).toLocaleString() : "—";
  const failedSyncs = syncs.filter((s) => !s.ok).length;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm text-ink-gray-5">{t(locale, "Monitoring")}</div>
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Sync Health")}</h1>
        <p className="text-sm text-ink-gray-5">{t(locale, "Confirm the offline queue synced correctly after the connection returned, and see how long the network was down.")}</p>
      </div>

      <SyncHealthLive />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label={t(locale, "Outages recorded")} value={String(outages.length)} accent={outages.length ? "amber" : "green"} />
        <StatCard label={t(locale, "Total downtime")} value={human(totalDowntime)} accent="amber" />
        <StatCard label={t(locale, "Failed syncs")} value={String(failedSyncs)} accent={failedSyncs ? "red" : "green"} />
        <StatCard label={t(locale, "Last sync")} value={lastSync} accent="brand" />
      </div>

      <Panel title={`${t(locale, "Internet outages")} (${outages.length})`}>
        {outages.length === 0 ? (
          <EmptyRow text={t(locale, "No outages recorded — the connection has been stable.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "Went offline")}</th>
                  <th className="px-4 py-2">{t(locale, "Came back")}</th>
                  <th className="px-4 py-2">{t(locale, "Duration")}</th>
                  <th className="px-4 py-2">{t(locale, "User")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {outages.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-gray-1">
                    <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">{new Date(o.went_offline_at).toLocaleString()}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">{new Date(o.came_online_at).toLocaleString()}</td>
                    <td className="px-4 py-2 font-medium tabular-nums text-amber-700">{human(Number(o.duration_seconds))}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{o.user_email ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title={`${t(locale, "Sync history")} (${syncs.length})`}>
        {syncs.length === 0 ? (
          <EmptyRow text={t(locale, "No sync activity yet.")} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "When")}</th>
                  <th className="px-4 py-2">{t(locale, "Result")}</th>
                  <th className="px-4 py-2">{t(locale, "Items")}</th>
                  <th className="px-4 py-2">{t(locale, "Detail")}</th>
                  <th className="px-4 py-2">{t(locale, "User")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {syncs.map((s) => (
                  <tr key={s.id} className="hover:bg-surface-gray-1">
                    <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">{new Date(s.synced_at).toLocaleString()}</td>
                    <td className="px-4 py-2">
                      {s.ok
                        ? <span className="inline-flex items-center gap-1 text-emerald-600"><CheckCircle2Icon size={14} /> {t(locale, "OK")}</span>
                        : <span className="inline-flex items-center gap-1 text-red-600"><XCircleIcon size={14} /> {t(locale, "Failed")}</span>}
                    </td>
                    <td className="px-4 py-2 tabular-nums text-ink-gray-6">{s.item_count}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{s.detail ?? "—"}</td>
                    <td className="px-4 py-2 text-ink-gray-5">{s.user_email ?? "—"}</td>
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
