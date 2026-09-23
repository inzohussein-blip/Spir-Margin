"use client";

import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import type { LinkState } from "@/app/actions/links";

/** What an action said: translated, with the machine's own words beside an error. */
export function Result({ state }: { state: LinkState | null }) {
  const locale = useLocale();
  if (state?.error) {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
        <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
        <span className="break-words">
          {t(locale, state.error)}
          {state.detail ? <span dir="ltr" className="mt-1 block font-mono text-xs text-red-600">{state.detail}</span> : null}
        </span>
      </div>
    );
  }
  if (state?.ok && state.message) {
    return (
      <div role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700">
        <CheckCircle2Icon size={16} className="mt-0.5 shrink-0" />
        <span>
          {t(locale, state.message)}
          {state.detail ? <span dir="ltr" className="mt-1 block font-mono text-xs">{state.detail}</span> : null}
        </span>
      </div>
    );
  }
  return null;
}
