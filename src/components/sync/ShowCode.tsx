"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CopyIcon, CheckIcon, EyeIcon, Loader2Icon } from "lucide-react";
import { showCodeAction, type LinkState } from "@/app/actions/links";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { Result } from "./Result";

function Reveal() {
  const locale = useLocale();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand disabled:opacity-60">
      {pending ? <Loader2Icon size={15} className="animate-spin" /> : <EyeIcon size={15} />}
      {t(locale, "Show the sync code")}
    </button>
  );
}

/**
 * The code other computers paste. Fetched on request rather than rendered
 * with the page, so it is not sitting in every copy of the page's HTML.
 */
export function ShowCode({ which }: { which: "lan" | "pg" }) {
  const locale = useLocale();
  const [state, action] = useFormState(showCodeAction, null as LinkState | null);
  const [copied, setCopied] = useState(false);

  if (!state?.code) {
    return (
      <form action={action} className="space-y-2">
        <input type="hidden" name="which" value={which} />
        {which === "lan" ? (
          <label className="block max-w-sm text-sm">
            <span className="font-medium text-ink-gray-8">{t(locale, "Which computer is this code for?")}</span>
            <input
              name="name"
              defaultValue={t(locale, "Office computer")}
              maxLength={120}
              className="mt-1 w-full rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <span className="mt-1 block text-xs text-ink-gray-5">{t(locale, "Each computer gets a code of its own, so one can be cut off without re-linking the others.")}</span>
          </label>
        ) : null}
        <Reveal />
        <Result state={state} />
      </form>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.code!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* the text is selectable anyway */
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        readOnly
        dir="ltr"
        data-sync-code={which}
        value={state.code}
        onFocus={(e) => e.currentTarget.select()}
        rows={3}
        className="w-full resize-none rounded-md border border-outline-gray-2 bg-surface-gray-1 px-3 py-2 font-mono text-xs text-ink-gray-8"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">
          {copied ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
          {copied ? t(locale, "Copied") : t(locale, "Copy the code")}
        </button>
        <span className="text-xs text-ink-gray-5">
          {t(locale, "This code opens all of the company's records. Give it only to computers of the company.")}
        </span>
      </div>
    </div>
  );
}
