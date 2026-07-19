import { getCurrentUser } from "@/lib/auth/current-user";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { Panel } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const locale = getLocale();
  const user = await getCurrentUser();
  if (!user) return null; // middleware guards this; belt-and-suspenders

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Account")}</h1>

      <Panel title={t(locale, "Profile")}>
        <dl className="grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-gray-4">Name</dt>
            <dd className="font-medium text-ink-gray-8">{user.full_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-gray-4">Email</dt>
            <dd className="font-medium text-ink-gray-8">{user.email}</dd>
          </div>
          <div>
            <dt className="text-ink-gray-4">Role</dt>
            <dd className="font-medium capitalize text-ink-gray-8">{user.role}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title={t(locale, "Change password")}>
        <div className="p-4">
          <ChangePasswordForm />
        </div>
      </Panel>
    </div>
  );
}
