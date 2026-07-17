"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { createUserAction } from "@/app/actions/users";

const cls =
  "mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <PlusIcon size={15} />}
      Add user
    </button>
  );
}

export function CreateUserForm() {
  const [state, formAction] = useFormState(createUserAction, null as { error?: string; ok?: boolean; message?: string } | null);
  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">Full name</span>
        <input name="full_name" className={cls} placeholder="Jane Doe" />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">Email</span>
        <input name="email" type="email" required className={cls} placeholder="jane@lab.com" />
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">Role</span>
        <select name="role" className={cls} defaultValue="staff">
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="staff">Staff</option>
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium text-ink-gray-8">Temporary password</span>
        <input name="password" type="text" required minLength={8} className={cls} placeholder="min 8 characters" />
      </label>
      <div className="sm:col-span-2">
        {state?.error ? <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
        {state?.ok ? <p className="mb-2 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{state.message}</p> : null}
        <SubmitButton />
      </div>
    </form>
  );
}
