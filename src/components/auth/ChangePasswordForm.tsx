"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { changePasswordAction } from "@/app/actions/auth";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : null}
      Update password
    </button>
  );
}

export function ChangePasswordForm() {
  const [state, formAction] = useFormState(
    changePasswordAction,
    null as { error?: string; ok?: boolean; message?: string } | null
  );
  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">Current password</span>
        <input name="current_password" type="password" autoComplete="current-password" required className={cls} />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">New password</span>
        <input name="new_password" type="password" autoComplete="new-password" required minLength={8} className={cls} />
        <span className="mt-1 block text-xs text-ink-gray-5">At least 8 characters.</span>
      </label>
      {state?.error ? <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      {state?.ok ? <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p> : null}
      <SubmitButton />
    </form>
  );
}
