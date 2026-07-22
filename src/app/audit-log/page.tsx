import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ListShell } from "@/components/desk/ListShell";
import { EmptyRow } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row {
  id: number;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  actor: string | null;
  changed_at: string;
  changed_fields: string[] | null;
}

const ACTION_STYLE: Record<string, string> = {
  INSERT: "bg-emerald-100 text-emerald-700",
  UPDATE: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};
const ACTION_LABEL: Record<string, string> = { INSERT: "إنشاء", UPDATE: "تعديل", DELETE: "حذف" };

export default async function AuditLogPage() {
  const locale = getLocale();
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return (
      <div className="rounded-lg border border-outline-gray-2 bg-surface-white p-8 text-center">
        <h1 className="text-lg font-semibold text-ink-gray-8">{t(locale, "Admins only")}</h1>
        <p className="mt-1 text-sm text-ink-gray-5">{t(locale, "You need an administrator account to view the audit log.")}</p>
      </div>
    );
  }

  const supabase = createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("id, table_name, record_id, action, actor, changed_at, changed_fields")
    .order("changed_at", { ascending: false })
    .limit(300);
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <ListShell
      title={t(locale, "Audit Log")}
      breadcrumbs={[{ label: t(locale, "Home"), href: "/" }, { label: t(locale, "Setup") }]}
      count={rows.length}
      filterPlaceholder={t(locale, "Filter by table / actor…")}
    >
      <div className="border-b border-outline-gray-1 bg-surface-gray-1 px-4 py-2 text-xs text-ink-gray-5">
        {t(locale, "This log is append-only — records can never be edited or deleted.")}
      </div>
      {rows.length === 0 ? (
        <EmptyRow text={t(locale, "No changes recorded yet.")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "Time")}</th>
                <th className="px-4 py-2">{t(locale, "Actor")}</th>
                <th className="px-4 py-2">{t(locale, "Table")}</th>
                <th className="px-4 py-2">{t(locale, "Record")}</th>
                <th className="px-4 py-2">{t(locale, "Action")}</th>
                <th className="px-4 py-2">{t(locale, "Changed fields")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-gray-1">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">
                    {new Date(r.changed_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{r.actor ?? "—"}</td>
                  <td className="px-4 py-2 font-medium">{r.table_name}</td>
                  <td className="px-4 py-2 font-mono text-xs text-ink-gray-4">{r.record_id?.slice(0, 8) ?? "—"}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STYLE[r.action]}`}>
                      {t(locale, ACTION_LABEL[r.action] ?? r.action)}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-ink-gray-5">
                    {r.changed_fields?.length ? r.changed_fields.join("، ") : "—"}
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
