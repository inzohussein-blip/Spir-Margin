"use client";

import { useFormState, useFormStatus } from "react-dom";
import { KeyRoundIcon, Loader2Icon } from "lucide-react";
import { setBuiltinPasswordAction, type BuiltinState } from "@/app/actions/builtin";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function Save() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <KeyRoundIcon size={15} />}
      {t(locale, "Change the password")}
    </button>
  );
}

/** Replace the built-in account's password (123 until someone does). */
export function BuiltinPasswordForm({ changed }: { changed: boolean }) {
  const locale = useLocale();
  const [state, action] = useFormState(setBuiltinPasswordAction, null as BuiltinState | null);
  return (
    <form action={action} className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">{t(locale, "Current password")}</span>
        <input name="current" type="password" autoComplete="current-password" required className={cls} placeholder={changed ? "" : "123"} />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">{t(locale, "New password")}</span>
        <input name="next" type="password" autoComplete="new-password" required minLength={8} className={cls} />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">{t(locale, "Repeat the new password")}</span>
        <input name="again" type="password" autoComplete="new-password" required minLength={8} className={cls} />
      </label>
      <div className="sm:col-span-3">
        {state?.error ? <p role="alert" className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{t(locale, state.error)}</p> : null}
        <Save />
      </div>
    </form>
  );
}
