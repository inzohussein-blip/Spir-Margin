import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { Indicator } from "@/components/desk/Indicator";
import { CreateUserForm } from "@/components/auth/CreateUserForm";
import { setUserActiveAction } from "@/app/actions/users";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

interface Row { id: string; email: string; full_name: string | null; role: string; is_active: boolean; created_at: string; }

export default async function UsersPage() {
  const locale = getLocale();
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return (
      <div className="rounded-lg border border-outline-gray-2 bg-surface-white p-8 text-center">
        <h1 className="text-lg font-semibold text-ink-gray-8">{t(locale, "Admins only")}</h1>
        <p className="mt-1 text-sm text-ink-gray-5">{t(locale, "You need an administrator account to manage users.")}</p>
      </div>
    );
  }

  const supabase = createClient();
  const { data } = await supabase.from("app_users").select("id, email, full_name, role, is_active, created_at").order("created_at");
  const rows = (data as unknown as Row[]) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Users")}</h1>
        <p className="text-sm text-ink-gray-5">{t(locale, "Manage who can sign in and their role.")}</p>
      </div>

      <Panel title={t(locale, "Add a user")}>
        <div className="p-4"><CreateUserForm /></div>
      </Panel>

      <Panel title={`${t(locale, "Users")} (${rows.length})`}>
        {rows.length === 0 ? <EmptyRow text={t(locale, "No users yet")} /> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-ink-gray-4">
                <th className="px-4 py-2">{t(locale, "Name")}</th><th className="px-4 py-2">{t(locale, "Email")}</th>
                <th className="px-4 py-2">{t(locale, "Role")}</th><th className="px-4 py-2">{t(locale, "Status")}</th><th className="px-4 py-2">{t(locale, "Action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-gray-1">
              {rows.map((u) => (
                <tr key={u.id} className="hover:bg-surface-gray-1">
                  <td className="px-4 py-2 font-medium">{u.full_name || "—"}</td>
                  <td className="px-4 py-2 text-ink-gray-6">{u.email}</td>
                  <td className="px-4 py-2 capitalize">{u.role}</td>
                  <td className="px-4 py-2"><Indicator status={u.is_active ? "active" : "inactive"} label={u.is_active ? "Active" : "Disabled"} /></td>
                  <td className="px-4 py-2">
                    {u.id === me.id ? (
                      <span className="text-xs text-ink-gray-4">(you)</span>
                    ) : (
                      <form action={setUserActiveAction}>
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="active" value={String(!u.is_active)} />
                        <button className={`rounded-md border px-2.5 py-1 text-xs font-medium ${u.is_active ? "border-outline-gray-2 text-ink-gray-6 hover:bg-surface-gray-1" : "border-brand bg-brand text-white hover:bg-brand-dark"}`}>
                          {u.is_active ? "Disable" : "Enable"}
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
