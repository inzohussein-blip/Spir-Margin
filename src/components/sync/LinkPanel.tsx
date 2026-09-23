"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Link2Icon, Loader2Icon, UnplugIcon } from "lucide-react";
import { linkWithCodeAction, unlinkAction, type LinkState } from "@/app/actions/links";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { ConfirmSubmit } from "@/components/settings/ConfirmSubmit";
import { Result } from "./Result";

function LinkButton() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <Link2Icon size={15} />}
      {pending ? t(locale, "Linking… this can take a minute") : t(locale, "Link")}
    </button>
  );
}

/** Paste a code from another computer's Sync page; or undo the link. */
export function LinkPanel({ linkedTo, locked }: { linkedTo: string | null; locked: boolean }) {
  const locale = useLocale();
  const [state, action] = useFormState(linkWithCodeAction, null as LinkState | null);
  const [unlinkState, unlink] = useFormState(async () => unlinkAction(), null as LinkState | null);

  if (locked) {
    return <p className="text-sm text-ink-gray-6">{t(locale, "This server was deployed with a hosted database, so it cannot be changed here.")}</p>;
  }

  return (
    <div className="space-y-4">
      {linkedTo ? (
        <form action={unlink} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2.5">
          <span className="text-sm text-ink-gray-7">
            {t(locale, "Linked to")} <strong dir="auto">{linkedTo}</strong>
          </span>
          <ConfirmSubmit
            confirmText={t(locale, "Stop syncing this computer? Nothing is deleted; it will simply work alone.")}
            className="inline-flex items-center gap-1.5 rounded-md border border-outline-gray-2 bg-surface-white px-3 py-1.5 text-sm text-ink-gray-7 hover:border-red-300 hover:text-red-700"
          >
            <UnplugIcon size={15} />
            {t(locale, "Unlink")}
          </ConfirmSubmit>
        </form>
      ) : null}

      <form action={action} className="space-y-2">
        <label className="block text-sm">
          <span className="font-medium text-ink-gray-8">{t(locale, "Sync code")}</span>
          <textarea
            name="code"
            dir="ltr"
            rows={3}
            required
            placeholder="SPIR1-…"
            className="mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-2 font-mono text-xs focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <span className="mt-1 block text-xs text-ink-gray-5">
            {t(locale, "Copy it from the Sync page of the main computer, or of any computer already linked to the hosted database.")}
          </span>
        </label>
        {linkedTo ? (
          <p className="text-xs text-amber-700">{t(locale, "Linking with a new code replaces the current link.")}</p>
        ) : null}
        <LinkButton />
      </form>
      <Result state={state ?? unlinkState} />
    </div>
  );
}
