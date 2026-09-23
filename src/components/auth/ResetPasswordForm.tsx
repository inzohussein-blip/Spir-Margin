"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { KeyRoundIcon, Loader2Icon } from "lucide-react";
import { resetUserPasswordAction } from "@/app/actions/users";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

type State = { error?: string; ok?: boolean; message?: string } | null;

function SaveButton() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? <Loader2Icon size={13} className="animate-spin" /> : null}
      {t(locale, "Save")}
    </button>
  );
}

/**
 * For a user who forgot their password: the administrator types a new one,
 * reads it back, and hands it over. Folded away until asked for, so the list
 * stays a list.
 */
export function ResetPasswordForm({ userId, userName }: { userId: string; userName: string }) {
  const locale = useLocale();
  // Each opening is a fresh form (a new key), so reopening after a reset does
  // not show the previous confirmation.
  const [round, setRound] = useState(0);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setRound((r) => r + 1); setOpen(true); }}
        className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-2.5 py-1 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1"
      >
        <KeyRoundIcon size={13} />
        {t(locale, "Reset password")}
      </button>
    );
  }
  return <Form key={round} userId={userId} userName={userName} onClose={() => setOpen(false)} />;
}

function Form({ userId, userName, onClose }: { userId: string; userName: string; onClose: () => void }) {
  const locale = useLocale();
  const [state, formAction] = useFormState(resetUserPasswordAction, null as State);

  if (state?.ok) {
    return (
      <div className="max-w-xs space-y-1.5">
        <p role="status" className="rounded-md bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-700">{t(locale, state.message ?? "")}</p>
        <button type="button" onClick={onClose} className="text-xs text-ink-gray-5 hover:text-ink-gray-8">
          {t(locale, "Close")}
        </button>
      </div>
    );
  }

  return (
    <form action={formAction} className="max-w-xs space-y-1.5">
      <input type="hidden" name="id" value={userId} />
      <label className="block text-xs">
        <span className="text-ink-gray-6">{t(locale, "New password for")} {userName}</span>
        <input
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="off"
          autoFocus
          dir="ltr"
          placeholder={t(locale, "min 8 characters")}
          className="mt-1 w-full rounded-md border border-outline-gray-2 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        />
      </label>
      {state?.error ? <p role="alert" className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs text-red-700">{t(locale, state.error)}</p> : null}
      <div className="flex items-center gap-2">
        <SaveButton />
        <button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-xs text-ink-gray-5 hover:text-ink-gray-8">
          {t(locale, "Cancel")}
        </button>
      </div>
    </form>
  );
}
