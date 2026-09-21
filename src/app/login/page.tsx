import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { GlobeIcon, ShieldCheckIcon } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { getLocale } from "@/lib/i18n-server";
import { PLATFORM_MODE_COOKIE, resolvePlatform } from "@/lib/auth/platform-mode";
import { CLOUD_ADMIN_EMAIL } from "@/lib/auth/cloud-credentials";
import { isHybridBuild } from "@/lib/runtime/platform";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/**
 * Sign-in for the NETWORKED platform only. The local platform needs no
 * sign-in, so this page never renders for it — both the middleware and the
 * guard below send those visitors straight to `/`.
 */
export default function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string };
}) {
  const platform = resolvePlatform(cookies().get(PLATFORM_MODE_COOKIE)?.value);
  if (platform === "local") redirect("/");
  if (platform === null) redirect("/welcome");

  const locale = getLocale();
  const next = typeof searchParams?.next === "string" ? searchParams.next : "";

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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700">
            <GlobeIcon size={12} />
            {t(locale, "Networked platform")}
          </span>
        </header>

        <h1 className="text-xl font-bold text-ink-gray-9">{t(locale, "Sign in")}</h1>
        <p className="mb-6 mt-1 text-sm text-ink-gray-5">
          {t(locale, "Medical-device sales, lab tracking & banking.")}
        </p>

        <LoginForm defaultEmail={CLOUD_ADMIN_EMAIL} next={next} />

        <div className="mt-5 flex items-start gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3 text-xs leading-relaxed text-ink-gray-6">
          <ShieldCheckIcon size={14} className="mt-0.5 shrink-0 text-brand" />
          <span>
            {t(
              locale,
              "Note: this account belongs to the shared online platform and works from any authorized computer.",
            )}
          </span>
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
