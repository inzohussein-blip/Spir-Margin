import { getCurrentUser } from "@/lib/auth/current-user";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";
import { Panel } from "@/components/dashboard/Panel";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { DEMO_USER_ID } from "@/lib/auth/demo-credentials";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: { changed?: string } }) {
  const locale = getLocale();
  const user = await getCurrentUser();
  if (!user) return null; // middleware guards this; belt-and-suspenders

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Account")}</h1>

      <Panel title={t(locale, "Profile")}>
        <dl className="grid grid-cols-1 gap-3 p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-ink-gray-4">{t(locale, "Name")}</dt>
            <dd className="font-medium text-ink-gray-8">{user.full_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-gray-4">{t(locale, "Email")}</dt>
            <dd className="font-medium text-ink-gray-8">{user.email}</dd>
          </div>
          <div>
            <dt className="text-ink-gray-4">{t(locale, "Role")}</dt>
            <dd className="font-medium text-ink-gray-8">{t(locale, user.role)}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title={t(locale, "Change password")}>
        <div className="p-4">
          {searchParams.changed ? (
            <p role="status" className="mb-4 max-w-sm rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {t(locale, "Password updated. Other devices signed in to this account have been signed out.")}
            </p>
          ) : null}
          {user.id === DEMO_USER_ID ? (
            <p className="text-sm text-ink-gray-6">
              {t(locale, "The built-in account's password is fixed in the program and cannot be changed. Create an account for each person under Users, and change passwords there.")}
            </p>
          ) : (
            <ChangePasswordForm />
          )}
        </div>
      </Panel>
    </div>
  );
}
