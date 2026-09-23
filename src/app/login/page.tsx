import Link from "next/link";
import { KeyRoundIcon, HardDriveIcon } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { getLocale } from "@/lib/i18n-server";
import { DEMO_EMAIL, DEMO_PASSWORD } from "@/lib/auth/demo-credentials";
import { t } from "@/lib/i18n";
import { builtinPasswordChanged } from "@/lib/auth/builtin";

export const dynamic = "force-dynamic";

/**
 * Sign-in. One platform, one built-in account.
 *
 * The credentials below are the ones in `demo-credentials.ts`, shown on the
 * form on purpose: this is a single-company install and the account is fixed
 * in the source, so there is nothing to discover and nothing to reset. It is
 * checked before any database call, so this page works on a machine with no
 * hosted database and no internet.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams?: { next?: string; ended?: string };
}) {
  const locale = getLocale();
  // Once an administrator has changed it, the password is theirs to know.
  const changed = await builtinPasswordChanged();
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
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
            <HardDriveIcon size={12} />
            {t(locale, "Works offline")}
          </span>
        </header>

        <h1 className="text-xl font-bold text-ink-gray-9">{t(locale, "Sign in")}</h1>
        <p className="mb-6 mt-1 text-sm text-ink-gray-5">
          {t(locale, "Medical-device sales, lab tracking & banking.")}
        </p>

        {searchParams?.ended ? (
          <p role="status" className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {t(locale, "Your session has ended because the password was changed or the account was disabled. Sign in again.")}
          </p>
        ) : null}

        <LoginForm defaultEmail={DEMO_EMAIL} next={next} />

        <div className="mt-5 rounded-lg border border-outline-gray-2 bg-surface-gray-1 p-3 text-xs leading-relaxed text-ink-gray-6">
          <div className="mb-1.5 flex items-center gap-2 font-semibold text-ink-gray-7">
            <KeyRoundIcon size={14} className="shrink-0 text-brand" />
            {t(locale, "Built-in account")}
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>{t(locale, "Email")}</dt>
            <dd className="font-mono text-ink-gray-8" dir="ltr">{DEMO_EMAIL}</dd>
            <dt>{t(locale, "Password")}</dt>
            <dd className={changed ? "text-ink-gray-6" : "font-mono text-ink-gray-8"} dir={changed ? undefined : "ltr"}>
              {changed ? t(locale, "Set by the administrator") : DEMO_PASSWORD}
            </dd>
          </dl>
          <p className="mt-2">
            {changed
              ? t(locale, "This account works on this computer with or without a network. Its password was changed in Settings.")
              : t(locale, "This account always works, with or without a network. Change its password in Settings before real use.")}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-center text-xs text-ink-gray-5">
          <Link href="/welcome" className="hover:text-brand hover:underline">
            {t(locale, "About Spir-Margin")}
          </Link>
        </div>
      </main>
    </div>
  );
}
