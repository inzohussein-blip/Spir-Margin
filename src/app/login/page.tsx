import Link from "next/link";
import { MonitorIcon, GlobeIcon } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { getLocale } from "@/lib/i18n-server";
import { getPlatformMode, inferPlatformMode } from "@/lib/auth/platform-mode-server";
import { LOCAL_ADMIN_EMAIL, LOCAL_ADMIN_PASSWORD } from "@/lib/auth/local-credentials";
import { t } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const locale = getLocale();
  const mode = getPlatformMode() ?? inferPlatformMode();
  const isLocal = mode === "local";

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl border border-outline-gray-2 bg-surface-white p-8 shadow-md">
        <div className="mb-6 flex items-center gap-2.5 text-lg font-bold tracking-tight text-ink-gray-8">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">S</span>
          Spir-Margin
        </div>

        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-outline-gray-2 bg-surface-gray-1 px-2.5 py-1 text-xs font-medium text-ink-gray-6">
          {isLocal ? <MonitorIcon size={12} /> : <GlobeIcon size={12} />}
          {isLocal ? t(locale, "Local platform") : t(locale, "Networked platform")}
        </div>

        <h1 className="text-xl font-bold text-ink-gray-9">{t(locale, "Sign in")}</h1>
        <p className="mb-6 mt-1 text-sm text-ink-gray-5">{t(locale, "Medical-device sales, lab tracking & banking.")}</p>
        <LoginForm />

        <p className="mt-4 rounded-md border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 text-xs leading-relaxed text-ink-gray-6">
          {isLocal ? (
            <>
              {t(
                locale,
                "Note: this password and any account you create are stored only on this computer (embedded local database) and cannot be used from another device.",
              )}
              <br />
              {t(locale, "Local sign-in:")}{" "}
              <code className="rounded bg-surface-white px-1.5 py-0.5 font-mono text-[11px] text-ink-gray-8">
                {LOCAL_ADMIN_EMAIL}
              </code>{" "}
              /{" "}
              <code className="rounded bg-surface-white px-1.5 py-0.5 font-mono text-[11px] text-ink-gray-8">
                {LOCAL_ADMIN_PASSWORD}
              </code>
            </>
          ) : (
            t(
              locale,
              "Note: this account belongs to the shared online platform and works from any authorized computer.",
            )
          )}
        </p>

        <div className="mt-4 text-center text-xs text-ink-gray-5">
          <Link href="/welcome" className="hover:text-brand hover:underline">
            {t(locale, "Change platform")}
          </Link>
        </div>
      </div>
    </div>
  );
}
