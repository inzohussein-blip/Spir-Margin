import { SettingsIcon, ToggleLeftIcon, ShieldIcon, Trash2Icon, LockIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { ConfirmSubmit } from "@/components/settings/ConfirmSubmit";
import { setFeatureStateAction, setUserAccessAction, deleteUserAccountAction } from "@/app/actions/settings";
import { TOGGLEABLE_FEATURES, type FeatureState } from "@/lib/features";
import { navGroups } from "@/lib/nav";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

const ICON = Object.fromEntries(navGroups.map((g) => [g.label, g.items[0]?.icon ?? SettingsIcon]));

const STATE_META: { key: FeatureState; label: string; on: string }[] = [
  { key: "enabled", label: "Enable", on: "bg-emerald-600 text-white border-emerald-600" },
  { key: "disabled", label: "Disable", on: "bg-amber-500 text-white border-amber-500" },
  { key: "hidden", label: "Hide", on: "bg-ink-gray-8 text-white border-ink-gray-8" },
];

export default async function SettingsPage() {
  const locale = getLocale();
  const me = await getCurrentUser();
  if (!me || me.role !== "admin") {
    return (
      <div className="rounded-2xl border border-outline-gray-2 bg-surface-white p-8 text-center">
        <h1 className="text-lg font-semibold text-ink-gray-8">{t(locale, "Admins only")}</h1>
        <p className="mt-1 text-sm text-ink-gray-5">{t(locale, "You need an administrator account to manage settings.")}</p>
      </div>
    );
  }

  const supabase = createClient();
  const [flagRes, usersRes, denyRes] = await Promise.all([
    supabase.from("feature_flags").select("feature, state"),
    supabase.from("app_users").select("id, email, full_name, role").order("created_at"),
    supabase.from("user_feature_access").select("user_id, feature"),
  ]);
  const flags = new Map<string, FeatureState>();
  for (const r of (flagRes.data as { feature: string; state: FeatureState }[] | null) ?? []) flags.set(r.feature, r.state);
  const users = (usersRes.data as { id: string; email: string; full_name: string | null; role: string }[] | null) ?? [];
  const denyByUser = new Map<string, Set<string>>();
  for (const r of (denyRes.data as { user_id: string; feature: string }[] | null) ?? []) {
    (denyByUser.get(r.user_id) ?? denyByUser.set(r.user_id, new Set()).get(r.user_id)!).add(r.feature);
  }
  const manageable = users.filter((u) => u.role !== "admin");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 place-items-center rounded-xl bg-brand/10 text-brand"><SettingsIcon size={19} /></span>
        <div>
          <h1 className="text-2xl font-bold text-ink-gray-8">{t(locale, "Settings")}</h1>
          <p className="text-sm text-ink-gray-5">{t(locale, "Manage which non-essential features are available across the app.")}</p>
        </div>
      </div>

      {/* ---- Feature switches ---- */}
      <Panel title={<span className="flex items-center gap-2"><ToggleLeftIcon size={16} className="text-brand" /> {t(locale, "Non-essential features")}</span>}>
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
          {TOGGLEABLE_FEATURES.map((feature) => {
            const Icon = ICON[feature] ?? SettingsIcon;
            const current = flags.get(feature) ?? "enabled";
            return (
              <div key={feature} className="flex items-center justify-between gap-3 rounded-xl border border-outline-gray-2 bg-surface-white p-3 shadow-sm">
                <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-ink-gray-8">
                  <Icon size={17} className="shrink-0 text-ink-gray-5" />
                  <span className="truncate">{t(locale, feature)}</span>
                </span>
                <div className="flex shrink-0 overflow-hidden rounded-lg border border-outline-gray-2">
                  {STATE_META.map((s) => {
                    const active = current === s.key;
                    return (
                      <form key={s.key} action={setFeatureStateAction}>
                        <input type="hidden" name="feature" value={feature} />
                        <input type="hidden" name="state" value={s.key} />
                        <button
                          type="submit"
                          className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${active ? s.on : "bg-surface-white text-ink-gray-5 hover:bg-surface-gray-1"}`}
                        >
                          {t(locale, s.label)}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="px-4 pb-3 text-xs text-ink-gray-4">
          {t(locale, "Disable")}: {t(locale, "This feature has been disabled by an administrator.")} · {t(locale, "Hide")}: {t(locale, "This feature is hidden.")}
        </p>
      </Panel>

      {/* ---- Per-account access ---- */}
      <Panel title={<span className="flex items-center gap-2"><ShieldIcon size={16} className="text-brand" /> {t(locale, "Feature access")}</span>}>
        <div className="border-b border-outline-gray-1 px-4 py-2 text-xs text-ink-gray-4">
          {t(locale, "All accounts have full access by default; deny specific features below.")}
        </div>
        {manageable.length === 0 ? (
          <EmptyRow text={t(locale, "No users yet")} />
        ) : (
          <div className="space-y-4 p-4">
            {manageable.map((u) => {
              const denied = denyByUser.get(u.id) ?? new Set<string>();
              return (
                <div key={u.id} className="rounded-xl border border-outline-gray-2 bg-surface-white p-3 shadow-sm">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-gray-8">{u.full_name || u.email}</p>
                      <p className="truncate text-xs text-ink-gray-4">{u.email} · <span className="capitalize">{u.role}</span></p>
                    </div>
                    <form action={deleteUserAccountAction}>
                      <input type="hidden" name="user_id" value={u.id} />
                      <ConfirmSubmit
                        confirmText={t(locale, "Delete this account permanently? This cannot be undone.")}
                        className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 active:scale-95"
                      >
                        <Trash2Icon size={13} /> {t(locale, "Delete account")}
                      </ConfirmSubmit>
                    </form>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {TOGGLEABLE_FEATURES.map((feature) => {
                      const isDenied = denied.has(feature);
                      return (
                        <form key={feature} action={setUserAccessAction}>
                          <input type="hidden" name="user_id" value={u.id} />
                          <input type="hidden" name="feature" value={feature} />
                          <input type="hidden" name="deny" value={String(!isDenied)} />
                          <button
                            type="submit"
                            title={isDenied ? t(locale, "Denied") : t(locale, "Allowed")}
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
                              isDenied
                                ? "border-red-200 bg-red-50 text-red-600 line-through hover:bg-red-100"
                                : "border-outline-gray-2 bg-surface-white text-ink-gray-6 hover:border-brand hover:text-brand"
                            }`}
                          >
                            {isDenied ? <LockIcon size={11} /> : null}
                            {t(locale, feature)}
                          </button>
                        </form>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
