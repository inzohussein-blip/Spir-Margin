import Link from "next/link";
import { LockIcon, ArrowLeftIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

/**
 * Shown in place of a page when the current account may not use the feature it
 * belongs to — either the feature is globally disabled, or this account was
 * denied access to it.
 */
export function FeatureUnavailable({ reason }: { reason: "disabled" | "denied" }) {
  const locale = getLocale();
  const message =
    reason === "denied"
      ? t(locale, "You don’t have access to this feature.")
      : t(locale, "This feature has been disabled by an administrator.");
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-outline-gray-2 bg-surface-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-surface-gray-1 text-ink-gray-4">
        <LockIcon size={26} />
      </span>
      <h1 className="text-lg font-bold text-ink-gray-8">{t(locale, "Feature unavailable")}</h1>
      <p className="mt-1.5 text-sm text-ink-gray-5">{message}</p>
      <p className="mt-1 text-xs text-ink-gray-4">{t(locale, "Ask an administrator to enable it or grant you access.")}</p>
      <Link
        href="/"
        className="mt-5 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:bg-brand-dark hover:shadow-md active:translate-y-0"
      >
        <ArrowLeftIcon size={15} /> {t(locale, "Back to dashboard")}
      </Link>
    </div>
  );
}
