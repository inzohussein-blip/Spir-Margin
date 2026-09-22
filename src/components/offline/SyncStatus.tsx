"use client";

import { WifiIcon, WifiOffIcon, RefreshCwIcon, CloudUploadIcon } from "lucide-react";
import { useOffline } from "./OfflineProvider";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/**
 * Connectivity, plus the sales queued in the browser.
 *
 * This is the BROWSER's outbox: a POS sale or sales order submitted while the
 * page could not reach the server, held in localStorage until it can be sent.
 * It is not the same thing as database sync — that is `DbSyncStatus`, which
 * owns whether this machine's data has reached the hosted database. So this
 * control stays quiet when its queue is empty rather than announcing
 * "all synced", which would be claiming something it does not know.
 */
export function SyncStatus({ compact = false }: { compact?: boolean }) {
  const locale = useLocale();
  const { online, pending, syncing, flush } = useOffline();
  const count = pending.length;

  return (
    <div className="flex items-center gap-2">
      {/* connectivity chip */}
      <span
        title={online ? t(locale, "Online") : t(locale, "Offline")}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${
          online
            ? "border-outline-gray-2 bg-surface-white text-ink-gray-6"
            : "border-amber-200 bg-amber-50 text-amber-700"
        }`}
      >
        <span className={`size-2 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`} />
        {online ? <WifiIcon size={13} /> : <WifiOffIcon size={13} />}
        {!compact && <span className="hidden sm:inline">{online ? t(locale, "Online") : t(locale, "Offline")}</span>}
      </span>

      {/* pending / sync control */}
      {count > 0 ? (
        <button
          type="button"
          onClick={() => flush()}
          disabled={syncing || !online}
          title={t(locale, "Sync now")}
          className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand-light px-2.5 py-1 text-xs font-semibold text-brand transition-all hover:bg-brand hover:text-white active:scale-95 disabled:opacity-60"
        >
          {syncing ? <RefreshCwIcon size={13} className="animate-spin" /> : <CloudUploadIcon size={13} />}
          <span>{syncing ? t(locale, "Syncing…") : t(locale, "Sync now")}</span>
          <span className="rounded-full bg-white/80 px-1.5 text-brand tabular-nums">{count}</span>
        </button>
      ) : null}
    </div>
  );
}
