"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DatabaseIcon, RefreshCwIcon, CloudOffIcon, CheckIcon, AlertTriangleIcon } from "lucide-react";
import { getSyncStatusAction, syncNowAction } from "@/app/actions/sync";
import type { SyncStatus } from "@/lib/sync/engine";
import { useLocale } from "@/components/LocaleProvider";
import { fmtNum } from "@/lib/format";
import { t } from "@/lib/i18n";

/** How often to re-read the local status, and to try an automatic sync. */
const STATUS_MS = 20_000;
const AUTO_SYNC_MS = 60_000;

/**
 * Database sync for the header.
 *
 * The app always works on this machine's own database, so this control never
 * blocks anything — it reports whether a hosted database is configured, how
 * much local work is still only here, and lets someone push it now instead of
 * waiting for the automatic pass.
 */
export function DbSyncStatus() {
  const locale = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [pending, startTransition] = useTransition();
  const running = useRef(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await getSyncStatusAction());
    } catch {
      /* the status poll is best-effort; the app does not depend on it */
    }
  }, []);

  const sync = useCallback(
    async (manual: boolean) => {
      if (running.current) return;
      running.current = true;
      try {
        const res = await syncNowAction();
        await refresh();
        // Only disturb the page when something actually arrived.
        if (res.ok && res.pulled > 0) startTransition(() => router.refresh());
      } catch {
        if (manual) await refresh();
      } finally {
        running.current = false;
      }
    },
    [refresh, router],
  );

  useEffect(() => {
    void refresh();
    const s = setInterval(refresh, STATUS_MS);
    return () => clearInterval(s);
  }, [refresh]);

  // Automatic sync while a hosted database is configured and the browser
  // believes it has a connection. A failure just leaves the work queued.
  useEffect(() => {
    if (!status?.configured) return;
    const tick = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      void sync(false);
    };
    const id = setInterval(tick, AUTO_SYNC_MS);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", tick);
    };
  }, [status?.configured, sync]);

  if (!status) return null;

  // No hosted database at all: this install is standalone on purpose, so say
  // so quietly rather than showing a broken-looking sync control.
  if (!status.configured) {
    return (
      <span
        title={t(locale, "No hosted database is configured. Everything is stored on this computer.")}
        className="inline-flex items-center gap-1.5 rounded-full border border-outline-gray-2 bg-surface-white px-2 py-1 text-xs font-medium text-ink-gray-5"
      >
        <DatabaseIcon size={13} />
        <span className="hidden lg:inline">{t(locale, "This computer only")}</span>
      </span>
    );
  }

  const busy = running.current || pending;
  const failed = !!status.lastError;
  const waiting = status.pending > 0;

  return (
    <button
      type="button"
      onClick={() => void sync(true)}
      disabled={busy}
      title={
        failed
          ? `${t(locale, "Last sync failed")}: ${status.lastError}`
          : waiting
            ? t(locale, "Changes are waiting to be sent")
            : t(locale, "Everything is synced")
      }
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all active:scale-95 disabled:opacity-60 ${
        failed
          ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
          : waiting
            ? "border-brand/30 bg-brand-light text-brand hover:bg-brand hover:text-white"
            : "border-outline-gray-2 bg-surface-white text-ink-gray-5 hover:bg-surface-gray-2"
      }`}
    >
      {busy ? (
        <RefreshCwIcon size={13} className="animate-spin" />
      ) : failed ? (
        <AlertTriangleIcon size={13} />
      ) : waiting ? (
        <CloudOffIcon size={13} />
      ) : (
        <CheckIcon size={13} className="text-emerald-500" />
      )}
      <span className="hidden lg:inline">
        {busy
          ? t(locale, "Syncing…")
          : failed
            ? t(locale, "Sync failed")
            : waiting
              ? t(locale, "Sync now")
              : t(locale, "Synced")}
      </span>
      {waiting && (
        <span className="rounded-full bg-white/80 px-1.5 tabular-nums">{fmtNum(status.pending)}</span>
      )}
    </button>
  );
}
