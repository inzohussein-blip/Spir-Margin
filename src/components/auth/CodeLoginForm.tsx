"use client";

import { useFormState, useFormStatus } from "react-dom";
import { KeyRoundIcon, Loader2Icon } from "lucide-react";
import { codeLoginAction } from "@/app/actions/auth";
import type { LoginState } from "@/lib/auth/login-state";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

function SubmitButton() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-brand to-brand-dark px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0">
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <KeyRoundIcon size={15} />}
      {pending ? t(locale, "Signing in…") : t(locale, "Open the whole system")}
    </button>
  );
}

/** «The whole system» with the company's activation code (see codeLoginAction). */
export function CodeLoginForm({ next = "" }: { next?: string }) {
  const locale = useLocale();
  const [state, formAction] = useFormState<LoginState, FormData>(codeLoginAction, null);
  const errKey = state && "error" in state ? state.error : null;
  return (
    <form action={formAction} className="space-y-3" noValidate data-testid="code-login">
      <input type="hidden" name="next" value={next} />
      <label htmlFor="login-code" className="block text-xs font-medium text-ink-gray-7">{t(locale, "Activation code")}</label>
      <input id="login-code" name="code" autoComplete="off" spellCheck={false} dir="ltr" placeholder="XXXX-XXXX-XXXX" autoFocus
        aria-invalid={!!errKey}
        className="w-full rounded-lg border border-outline-gray-2 bg-surface-white px-3 py-2.5 text-center font-mono text-base uppercase tracking-widest shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25" />
      {errKey ? (
        <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <span aria-hidden>⚠</span><span>{t(locale, errKey)}</span>
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
