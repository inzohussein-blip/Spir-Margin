import Link from "next/link";
import { redirect } from "next/navigation";
import { GlobeIcon, MonitorIcon, WifiOffIcon, ShieldCheckIcon } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { getLocale } from "@/lib/i18n-server";
import { getPlatformMode, inferPlatformMode } from "@/lib/auth/platform-mode-server";
import { LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_PASSWORD } from "@/lib/auth/local-credentials";
import { CLOUD_ADMIN_EMAIL } from "@/lib/auth/cloud-credentials";
import { isCloudBuild, isHybridBuild, isLocalBuild } from "@/lib/runtime/platform";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  // Local trial has no sign-in — every request is already the local admin.
  // Any direct hit on /login just goes home. (Middleware also handles this,
  // but the redirect here belt-and-suspenders any deep link.)
  if (isLocalBuild) redirect("/");

  const locale = getLocale();
  const mode = isCloudBuild
    ? "networked"
    : getPlatformMode() ?? inferPlatformMode();
  const isLocal = mode === "local";
  const next = typeof searchParams?.next === "string" ? searchParams.next : "";
  const defaultEmail = isLocal ? LOCAL_ADMIN_EMAIL : isCloudBuild ? CLOUD_ADMIN_EMAIL : "";

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-surface-gray-1 p-4">
      {/* Soft brand halos */}
      <div aria-hidden className="pointer-events-none absolute -top-24 -start-24 size-64 rounded-full bg-brand/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -end-24 size-72 rounded-full bg-brand-dark/10 blur-3xl" />

      <main className="relative w-full max-w-sm rounded-2xl border border-outline-gray-2 bg-surface-white/95 p-8 shadow-lg backdrop-blur-xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-gray-9">
            <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
              S
            </span>
            Spir-Margin
          </div>
          <ModeBadge locale={locale} isLocal={isLocal} />
        </header>

        <h1 className="text-xl font-bold text-ink-gray-9">{t(locale, "Sign in")}</h1>
        <p className="mb-6 mt-1 text-sm text-ink-gray-5">
          {t(locale, "Medical-device sales, lab tracking & banking.")}
        </p>

        <LoginForm defaultEmail={defaultEmail} next={next} />

        <div className="mt-5 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3 text-xs leading-relaxed text-ink-gray-6">
          {isLocal ? (
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <WifiOffIcon size={14} className="mt-0.5 shrink-0 text-brand" />
                <span>
                  {t(
                    locale,
                    "Note: this password and any account you create are stored only on this computer (embedded local database) and cannot be used from another device.",
                  )}
                </span>
              </div>
              <div className="rounded-md border border-dashed border-outline-gray-2 bg-surface-white px-2.5 py-2">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-gray-5">
                  {t(locale, "Local sign-in:")}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <code className="rounded bg-surface-gray-1 px-1.5 py-0.5 font-mono text-[11px] text-ink-gray-8">
                    {LOCAL_ADMIN_EMAIL}
                  </code>
                  <span className="text-ink-gray-4">/</span>
                  <code className="rounded bg-surface-gray-1 px-1.5 py-0.5 font-mono text-[11px] text-ink-gray-8">
                    {LOCAL_ADMIN_PASSWORD}
                  </code>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <ShieldCheckIcon size={14} className="mt-0.5 shrink-0 text-brand" />
              <span>
                {t(
                  locale,
                  "Note: this account belongs to the shared online platform and works from any authorized computer.",
                )}
              </span>
            </div>
          )}
        </div>

        {isHybridBuild ? (
          <div className="mt-4 flex items-center justify-center gap-3 text-xs text-ink-gray-5">
            <Link href="/welcome" className="hover:text-brand hover:underline">
              {t(locale, "Change platform")}
            </Link>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function ModeBadge({ locale, isLocal }: { locale: import("@/lib/i18n").Locale; isLocal: boolean }) {
  const label = isLocal ? t(locale, "Local platform") : t(locale, "Networked platform");
  const Icon = isLocal ? MonitorIcon : GlobeIcon;
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium " +
        (isLocal
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-sky-200 bg-sky-50 text-sky-700")
      }
    >
      <Icon size={12} />
      {label}
    </span>
  );
}
