import type { ReactNode } from "react";
import { MonitorIcon, GlobeIcon } from "lucide-react";
import { setPlatformModeAction } from "@/app/actions/auth";
import { getLocale } from "@/lib/i18n-server";
import { inferPlatformMode } from "@/lib/auth/platform-mode-server";
import { t, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function WelcomePage() {
  const locale = getLocale();
  const suggested = inferPlatformMode();

  return (
    <div className="grid min-h-screen place-items-center bg-surface-gray-1 p-6">
      <div className="w-full max-w-2xl rounded-2xl border border-outline-gray-2 bg-surface-white p-8 shadow-md">
        <div className="mb-6 flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-gray-8">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
            S
          </span>
          Spir-Margin
        </div>
        <h1 className="text-xl font-bold text-ink-gray-9">
          {t(locale, "Choose your platform")}
        </h1>
        <p className="mb-6 mt-1 text-sm text-ink-gray-5">
          {t(
            locale,
            "Pick how you want to run Spir-Margin. You can change this later.",
          )}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <ModeCard
            mode="local"
            title={t(locale, "Local platform")}
            desc={t(
              locale,
              "Runs entirely on this computer. No internet required. Data and accounts never leave this machine.",
            )}
            icon={<MonitorIcon size={22} />}
            recommended={suggested === "local"}
            locale={locale}
          />
          <ModeCard
            mode="networked"
            title={t(locale, "Networked platform")}
            desc={t(
              locale,
              "Connects to a shared online database, so the same account works from any authorized computer.",
            )}
            icon={<GlobeIcon size={22} />}
            recommended={suggested === "networked"}
            locale={locale}
          />
        </div>

        <p className="mt-6 text-xs text-ink-gray-5">
          {suggested === "local"
            ? t(
                locale,
                "Note: this server has no DATABASE_URL configured, so it will store data locally (embedded PGlite Postgres).",
              )
            : t(
                locale,
                "Note: this server is configured with DATABASE_URL, so it will use the shared online database.",
              )}
        </p>
      </div>
    </div>
  );
}

function ModeCard({
  mode,
  title,
  desc,
  icon,
  recommended,
  locale,
}: {
  mode: "local" | "networked";
  title: string;
  desc: string;
  icon: ReactNode;
  recommended: boolean;
  locale: Locale;
}) {
  return (
    <form action={setPlatformModeAction}>
      <input type="hidden" name="mode" value={mode} />
      <button
        type="submit"
        className="group flex h-full w-full flex-col items-start gap-3 rounded-xl border border-outline-gray-2 bg-surface-white p-5 text-start transition hover:border-brand hover:bg-brand/5 focus:outline-none focus:ring-2 focus:ring-brand"
      >
        <div className="flex w-full items-center justify-between">
          <span className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand">
            {icon}
          </span>
          {recommended ? (
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
              {t(locale, "Recommended")}
            </span>
          ) : null}
        </div>
        <div className="text-base font-semibold text-ink-gray-9">{title}</div>
        <div className="text-sm leading-relaxed text-ink-gray-6">{desc}</div>
        <div className="mt-auto pt-2 text-sm font-medium text-brand group-hover:underline">
          {t(locale, "Continue")} →
        </div>
      </button>
    </form>
  );
}
