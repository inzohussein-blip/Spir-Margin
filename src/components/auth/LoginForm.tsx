"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon } from "lucide-react";
import { loginAction } from "@/app/actions/auth";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
    >
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : null}
      Sign in
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useFormState(loginAction, null as { error?: string } | null);
  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">Email</span>
        <input name="email" type="email" autoComplete="username" required className={cls} placeholder="admin@spir.local" />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className={cls} placeholder="••••••••" />
      </label>
      {state?.error ? (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
