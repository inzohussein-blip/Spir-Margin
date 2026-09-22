"use client";

import { t } from "@/lib/i18n";
import { fmtNum } from "@/lib/format";
import { useLocale } from "@/components/LocaleProvider";
import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { setUsdIqdRateAction } from "@/app/actions/currency";

function SubmitButton() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : null}
      {t(locale, "Save today's rate")}
    </button>
  );
}

export function DailyRateCard({ currentRate }: { currentRate: number }) {
  const locale = useLocale();
  const [state, formAction] = useFormState(setUsdIqdRateAction, null as { error?: string; ok?: boolean; message?: string } | null);
  return (
    <div className="rounded-xl border border-outline-gray-2 bg-surface-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-ink-gray-8">{t(locale, "Daily USD → IQD rate")}</h2>
      <p className="mt-1 text-sm text-ink-gray-5">{t(locale, "Today:")}<span className="font-bold text-ink-gray-9">{currentRate > 0 ? `1 USD = ${fmtNum(currentRate)} IQD` : t(locale, "not set")}</span>
      </p>
      <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block text-sm">
          <span className="font-medium text-ink-gray-8">{t(locale, "New rate (IQD per 1 USD)")}</span>
          <input name="rate" type="number" step="1" min="1" required defaultValue={currentRate || ""} placeholder="1310"
            className="mt-1 w-40 rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
        </label>
        <SubmitButton />
      </form>
      {state?.error ? <p className="mt-2 text-sm text-red-700">{state.error}</p> : null}
      {state?.ok ? <p className="mt-2 text-sm text-emerald-700">{state.message}</p> : null}
    </div>
  );
}
