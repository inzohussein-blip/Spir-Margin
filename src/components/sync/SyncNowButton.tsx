"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { syncNowAction } from "@/app/actions/sync";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import type { SyncResult } from "@/lib/sync/core";

/** Sync this computer now, and say what moved. */
export function SyncNowButton() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(await syncNowAction());
            router.refresh();
          })
        }
        className="inline-flex items-center gap-2 rounded-md border border-outline-gray-2 px-3 py-1.5 text-sm font-medium text-ink-gray-7 hover:border-brand hover:text-brand disabled:opacity-60"
      >
        {pending ? <Loader2Icon size={15} className="animate-spin" /> : <RefreshCwIcon size={15} />}
        {t(locale, "Sync now")}
      </button>
      {result ? (
        <span role="status" data-sync-result={result.ok ? "ok" : "failed"} className={`text-sm ${result.ok ? "text-emerald-700" : "text-amber-700"}`}>
          {result.ok
            ? `${t(locale, "Sent")} ${result.pushed} · ${t(locale, "Brought in")} ${result.pulled}`
            : t(locale, result.error ?? "Sync failed")}
        </span>
      ) : null}
    </div>
  );
}
