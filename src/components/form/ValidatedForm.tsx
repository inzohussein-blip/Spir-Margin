"use client";

import { useState, useTransition, type ReactNode } from "react";
import { AlertCircleIcon } from "lucide-react";

/**
 * A form that shows what the database refused, in place.
 *
 * Server actions here end in `redirect()` on success. On a failure the person
 * can fix — a code already in use, a required field left empty — the action
 * returns `{ error }` instead of throwing, and this renders it above the
 * fields WITHOUT navigating, so nothing that was typed is lost. Anything the
 * action still throws is a real fault and reaches the error boundary as
 * before.
 */
export function ValidatedForm({
  action,
  children,
  className,
  id,
}: {
  action: (fd: FormData) => Promise<{ error?: string } | void>;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  return (
    <form
      id={id}
      className={className}
      action={(fd) => {
        setError(null);
        startTransition(async () => {
          // A successful action redirects, which throws NEXT_REDIRECT and is
          // handled by the router — so nothing after this runs on success.
          const res = await action(fd);
          if (res && "error" in res && res.error) setError(res.error);
        });
      }}
    >
      {error && (
        <div
          role="alert"
          className="col-span-full flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700"
        >
          <AlertCircleIcon size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {children}
    </form>
  );
}
