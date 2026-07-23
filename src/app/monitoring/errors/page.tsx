import { CheckCircle2Icon, Trash2Icon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { MonitoringUnauthorized } from "@/components/monitoring/Unauthorized";
import { setErrorResolved, clearResolvedErrors } from "@/app/actions/monitoring";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: number; occurred_at: string; severity: string; source: string;
  message: string; detail: string | null; path: string | null;
  user_email: string | null; resolved: boolean;
}

export default async function ErrorMonitorPage() {
  const locale = getLocale();
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return <MonitoringUnauthorized />;

  const supabase = createClient();
  const { data } = await supabase
    .from("app_errors")
    .select("id, occurred_at, severity, source, message, detail, path, user_email, resolved")
    .order("occurred_at", { ascending: false })
    .limit(300);
  const rows = (data as unknown as Row[]) ?? [];
  const open = rows.filter((r) => !r.resolved);
  const dayAgo = Date.now() - 24 * 3600 * 1000;
  const last24 = rows.filter((r) => new Date(r.occurred_at).getTime() >= dayAgo);

  return (
    <ListShell
      title={t(locale, "Error Monitor")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Monitoring") }]}
      count={rows.length}
      filterPlaceholder={t(locale, "Filter errors…")}
    >
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Open errors")} value={String(open.length)} accent={open.length ? "red" : "green"} />
        <StatCard label={t(locale, "Last 24 hours")} value={String(last24.length)} accent={last24.length ? "amber" : "green"} />
        <StatCard label={t(locale, "Total logged")} value={String(rows.length)} accent="brand" />
      </div>

      {open.length === 0 && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2Icon size={17} /> {t(locale, "No open errors — everything is working normally.")}
        </div>
      )}

      <div className="flex items-center justify-between border-b border-outline-gray-1 px-4 py-2">
        <span className="text-xs text-ink-gray-5">{t(locale, "Newest first · client, server and error-boundary reports.")}</span>
        <form action={clearResolvedErrors}>
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 transition-colors hover:bg-surface-gray-1">
            <Trash2Icon size={13} /> {t(locale, "Clear resolved")}
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyRow text={t(locale, "No errors recorded yet.")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "When")}</th>
                <th className="px-4 py-2">{t(locale, "Severity")}</th>
                <th className="px-4 py-2">{t(locale, "Source")}</th>
                <th className="px-4 py-2">{t(locale, "Message")}</th>
                <th className="px-4 py-2">{t(locale, "Path")}</th>
                <th className="px-4 py-2">{t(locale, "User")}</th>
                <th className="px-4 py-2">{t(locale, "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {rows.map((r) => (
                <tr key={r.id} className={r.resolved ? "opacity-50" : ""}>
                  <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">{new Date(r.occurred_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
                      {t(locale, r.severity === "warning" ? "Warning" : "Error")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-gray-5">{t(locale, r.source === "server" ? "Server" : "Client")}</td>
                  <td className="max-w-md px-4 py-2">
                    <p className="truncate font-medium text-ink-gray-8" title={r.message}>{r.message}</p>
                    {r.detail ? <p className="truncate text-xs text-ink-gray-4" title={r.detail}>{r.detail.split("\n")[0]}</p> : null}
                  </td>
                  <td className="px-4 py-2 text-ink-gray-5">{r.path ?? "—"}</td>
                  <td className="px-4 py-2 text-ink-gray-5">{r.user_email ?? "—"}</td>
                  <td className="px-4 py-2">
                    <form action={setErrorResolved}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="resolved" value={String(!r.resolved)} />
                      <button className={`rounded-md border px-2.5 py-1 text-xs font-medium ${r.resolved ? "border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-1" : "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600"}`}>
                        {r.resolved ? t(locale, "Reopen") : t(locale, "Resolve")}
                      </button>
                    </form>
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
