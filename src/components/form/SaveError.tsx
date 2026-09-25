"use client";

import { AlertCircleIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/**
 * Why a save failed, next to the button that tried it. Every form that calls
 * a save action must show this: a failed save that says nothing looks like a
 * button that does not work.
 */
export function SaveError({ error }: { error: string | null }) {
  const locale = useLocale();
  if (!error) return null;
  return (
    <p role="alert" data-save-error className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <AlertCircleIcon size={16} className="mt-0.5 shrink-0" />
      <span>{t(locale, error)}</span>
    </p>
  );
}
