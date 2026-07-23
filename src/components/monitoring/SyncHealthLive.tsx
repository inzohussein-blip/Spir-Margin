"use client";

import { WifiIcon, WifiOffIcon, CheckCircle2Icon, CloudUploadIcon } from "lucide-react";
import { useOffline } from "@/components/offline/OfflineProvider";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/** Live "right now" sync state: online/offline + how many sales still queued. */
export function SyncHealthLive() {
  const locale = useLocale();
  const { online, pending, syncing, flush } = useOffline();
  const count = pending.length;
  const healthy = online && count === 0;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 shadow-sm ${
        healthy ? "border-emerald-200 bg-emerald-50" : online ? "border-brand/30 bg-brand-light" : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`grid size-11 place-items-center rounded-xl ${healthy ? "bg-emerald-500 text-white" : online ? "bg-brand text-white" : "bg-amber-500 text-white"}`}>
          {online ? <WifiIcon size={22} /> : <WifiOffIcon size={22} />}
        </span>
        <div>
          <p className="text-sm font-bold text-ink-gray-8">
            {online ? t(locale, "Online") : t(locale, "Offline")}
            {count > 0 ? ` · ${count} ${t(locale, "waiting to sync")}` : ""}
          </p>
          <p className="flex items-center gap-1 text-xs text-ink-gray-5">
            {healthy ? <><CheckCircle2Icon size={13} className="text-emerald-600" /> {t(locale, "Everything is synced.")}</>
              : count > 0 ? t(locale, "Some sales are still on this device.")
              : t(locale, "Sales will be saved here until the connection returns.")}
          </p>
        </div>
      </div>
      {count > 0 && (
        <button
          type="button"
          onClick={() => flush()}
          disabled={syncing || !online}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-px hover:bg-brand-dark active:translate-y-0 disabled:opacity-60"
        >
          <CloudUploadIcon size={15} /> {syncing ? t(locale, "Syncing…") : t(locale, "Sync now")}
        </button>
      )}
    </div>
  );
}
