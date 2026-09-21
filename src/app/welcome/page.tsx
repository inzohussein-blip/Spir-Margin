import type { ReactNode } from "react";
import { MonitorIcon, GlobeIcon, WifiOffIcon, CloudIcon } from "lucide-react";
import { setPlatformModeAction } from "@/app/actions/auth";
import { getLocale } from "@/lib/i18n-server";
import { inferPlatformMode } from "@/lib/auth/platform-mode-server";
import { t, type Locale } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function WelcomePage() {
  const locale = getLocale();
  const suggested = inferPlatformMode();

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-surface-gray-1 p-4">
      <div aria-hidden className="pointer-events-none absolute -top-24 -start-24 size-64 rounded-full bg-brand/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -end-24 size-72 rounded-full bg-brand-dark/10 blur-3xl" />

      <main className="relative w-full max-w-2xl rounded-2xl border border-outline-gray-2 bg-surface-white/95 p-8 shadow-lg backdrop-blur-xl">
        <div className="mb-6 flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-gray-9">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">
            S
          </span>
          Spir-Margin
        </div>

        <h1 className="text-xl font-bold text-ink-gray-9">
          {t(locale, "Choose your platform")}
        </h1>
        <p className="mb-6 mt-1 text-sm text-ink-gray-5">
          {t(locale, "Pick how you want to run Spir-Margin. You can change this later.")}
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <ModeCard
            mode="local"
            title={t(locale, "Local platform")}
            desc={t(
              locale,
              "Free trial. Runs entirely on this computer with no sign-in — you go straight in. Data never leaves this machine.",
            )}
            icon={<MonitorIcon size={22} />}
            tag={<WifiOffIcon size={11} />}
            tagLabel={t(locale, "No sign-in")}
            tone="emerald"
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
            tag={<CloudIcon size={11} />}
            tagLabel={t(locale, "Multi-device")}
            tone="sky"
            recommended={suggested === "networked"}
            locale={locale}
          />
        </div>

        <p className="mt-6 rounded-md border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-xs text-ink-gray-6">
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
      </main>
    </div>
  );
}

type Tone = "emerald" | "sky";

const toneClasses: Record<Tone, { chip: string; icon: string; ring: string }> = {
  emerald: {
    chip: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: "bg-emerald-100 text-emerald-700",
    ring: "focus:ring-emerald-500/40 hover:border-emerald-400",
  },
  sky: {
    chip: "border-sky-200 bg-sky-50 text-sky-700",
    icon: "bg-sky-100 text-sky-700",
    ring: "focus:ring-sky-500/40 hover:border-sky-400",
  },
};

function ModeCard({
  mode,
  title,
  desc,
  icon,
  tag,
  tagLabel,
  tone,
  recommended,
  locale,
}: {
  mode: "local" | "networked";
  title: string;
  desc: string;
  icon: ReactNode;
  tag: ReactNode;
  tagLabel: string;
  tone: Tone;
  recommended: boolean;
  locale: Locale;
}) {
  const c = toneClasses[tone];
  return (
    <form action={setPlatformModeAction}>
      <input type="hidden" name="mode" value={mode} />
      <button
        type="submit"
        className={
          "group flex h-full w-full flex-col items-start gap-3 rounded-xl border border-outline-gray-2 bg-surface-white p-5 text-start shadow-sm transition hover:-translate-y-0.5 hover:shadow focus:outline-none focus:ring-2 " +
          c.ring
        }
      >
        <div className="flex w-full items-center justify-between">
          <span className={"grid size-10 place-items-center rounded-lg " + c.icon}>{icon}</span>
          <div className="flex items-center gap-1.5">
            <span className={"inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium " + c.chip}>
              {tag}
              {tagLabel}
            </span>
            {recommended ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                {t(locale, "Recommended")}
              </span>
            ) : null}
          </div>
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
