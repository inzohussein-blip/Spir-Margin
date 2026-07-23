import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { MonitoringUnauthorized } from "@/components/monitoring/Unauthorized";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: number; table_name: string; record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE"; actor: string | null;
  changed_at: string; changed_fields: string[] | null;
}

const ACTION_STYLE: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};
const ACTION_KEY: Record<string, string> = { INSERT: "Created", UPDATE: "Changed", DELETE: "Deleted" };

export default async function ChangeLogPage() {
  const locale = getLocale();
  const me = await getCurrentUser();
  if (!me || (me.role !== "admin" && me.role !== "manager")) return <MonitoringUnauthorized />;

  const supabase = createClient();
  // Focus on what was changed or deleted (the audit trail also records inserts).
  const { data } = await supabase
    .from("audit_log")
    .select("id, table_name, record_id, action, actor, changed_at, changed_fields")
    .in("action", ["UPDATE", "DELETE"])
    .order("changed_at", { ascending: false })
    .limit(300);
  const rows = (data as unknown as Row[]) ?? [];
  const deletes = rows.filter((r) => r.action === "DELETE").length;
  const updates = rows.filter((r) => r.action === "UPDATE").length;

  return (
    <ListShell
      title={t(locale, "Change & Deletion Log")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Monitoring") }]}
      count={rows.length}
      filterPlaceholder={t(locale, "Filter by table / user…")}
    >
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        <StatCard label={t(locale, "Deletions")} value={String(deletes)} accent={deletes ? "red" : "green"} />
        <StatCard label={t(locale, "Changes")} value={String(updates)} accent="amber" />
        <StatCard label={t(locale, "Total tracked")} value={String(rows.length)} accent="brand" />
      </div>

      <div className="border-b border-outline-gray-1 bg-surface-gray-1/60 px-4 py-2 text-xs text-ink-gray-5">
        {t(locale, "Every change and deletion on the money- and compliance-critical tables is recorded here and can never be edited or removed.")}
      </div>

      {rows.length === 0 ? (
        <EmptyRow text={t(locale, "No changes or deletions recorded yet.")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-start text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "When")}</th>
                <th className="px-4 py-2">{t(locale, "Action")}</th>
                <th className="px-4 py-2">{t(locale, "Table")}</th>
                <th className="px-4 py-2">{t(locale, "Record")}</th>
                <th className="px-4 py-2">{t(locale, "Changed fields")}</th>
                <th className="px-4 py-2">{t(locale, "User")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-gray-1">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">{new Date(r.changed_at).toLocaleString()}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLE[r.action]}`}>
                      {t(locale, ACTION_KEY[r.action] ?? r.action)}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-medium text-ink-gray-8">{r.table_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-ink-gray-5">{r.record_id ? r.record_id.slice(0, 8) : "—"}</td>
                  <td className="max-w-sm px-4 py-2 text-ink-gray-5">
                    {r.action === "DELETE"
                      ? <span className="text-red-600">{t(locale, "record removed")}</span>
                      : (r.changed_fields?.join("، ") || "—")}
                  </td>
                  <td className="px-4 py-2 text-ink-gray-5">{r.actor ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ListShell>
  );
}
