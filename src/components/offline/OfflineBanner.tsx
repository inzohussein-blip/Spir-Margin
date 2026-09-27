"use client";

import { WifiOffIcon } from "lucide-react";
import { useOffline } from "./OfflineProvider";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/**
 * Said at the top of every page while the server does not answer: what is on
 * screen may be the copy the offline worker kept, and sales made now wait in
 * this browser until the connection is back.
 */
export function OfflineBanner() {
  const locale = useLocale();
  const { serverUp, pending } = useOffline();
  if (serverUp) return null;
  return (
    <div role="status" data-testid="offline-banner"
      className="no-print sticky top-0 z-50 flex flex-wrap items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <WifiOffIcon size={15} />
      <span className="font-semibold">{t(locale, "No connection to the server")}</span>
      <span>{t(locale, "You are seeing the last saved copy of this page. Sales and sales orders are kept and sent by themselves when the connection is back.")}</span>
      {pending.length > 0 && <span className="rounded-full bg-amber-200 px-2 font-semibold tabular-nums">{pending.length} {t(locale, "waiting")}</span>}
    </div>
  );
}
