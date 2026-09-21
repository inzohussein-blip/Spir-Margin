"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { EyeIcon, EyeOffIcon, Loader2Icon, LogInIcon, MailIcon, LockIcon } from "lucide-react";
import { loginAction } from "@/app/actions/auth";
import type { LoginState } from "@/lib/auth/login-state";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

const inputCls =
  "w-full rounded-lg border border-outline-gray-2 bg-surface-white pl-10 pr-3 py-2.5 text-sm shadow-sm transition placeholder:text-ink-gray-4 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25";

const iconCls =
  "pointer-events-none absolute inset-y-0 start-3 grid place-items-center text-ink-gray-4";

function SubmitButton() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-b from-brand to-brand-dark px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-px hover:shadow disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
    >
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <LogInIcon size={15} />}
      {pending ? t(locale, "Signing in…") : t(locale, "Sign in")}
    </button>
  );
}

export function LoginForm({
  defaultEmail = "",
  next = "",
}: {
  defaultEmail?: string;
  next?: string;
}) {
  const locale = useLocale();
  const [state, formAction] = useFormState<LoginState, FormData>(loginAction, null);
  const [showPw, setShowPw] = useState(false);
  const errKey = state && "error" in state ? state.error : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="login-email" className="mb-1 block text-xs font-medium text-ink-gray-7">
          {t(locale, "Email")}
        </label>
        <div className="relative">
          <span className={iconCls}>
            <MailIcon size={15} />
          </span>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="username"
            required
            defaultValue={defaultEmail}
            placeholder="admin@spir.local"
            aria-invalid={!!errKey}
            className={inputCls}
          />
        </div>
      </div>

      <div>
        <label htmlFor="login-password" className="mb-1 block text-xs font-medium text-ink-gray-7">
          {t(locale, "Password")}
        </label>
        <div className="relative">
          <span className={iconCls}>
            <LockIcon size={15} />
          </span>
          <input
            id="login-password"
            name="password"
            type={showPw ? "text" : "password"}
            autoComplete="current-password"
            required
            placeholder="••••••••"
            aria-invalid={!!errKey}
            className={inputCls + " pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? t(locale, "Hide password") : t(locale, "Show password")}
            className="absolute inset-y-0 end-2 grid place-items-center rounded p-1 text-ink-gray-4 hover:text-ink-gray-7"
            tabIndex={-1}
          >
            {showPw ? <EyeOffIcon size={15} /> : <EyeIcon size={15} />}
          </button>
        </div>
      </div>

      {errKey ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          <span aria-hidden>⚠</span>
          <span>{t(locale, errKey)}</span>
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
