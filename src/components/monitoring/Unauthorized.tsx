import { LockIcon } from "lucide-react";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";

/** Shown when a non-authorised account reaches a monitoring page directly. */
export function MonitoringUnauthorized() {
  const locale = getLocale();
  return (
    <div className="mx-auto mt-10 max-w-md rounded-2xl border border-outline-gray-2 bg-surface-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-surface-gray-1 text-ink-gray-4">
        <LockIcon size={26} />
      </span>
      <h1 className="text-lg font-bold text-ink-gray-8">{t(locale, "Authorised staff only")}</h1>
      <p className="mt-1.5 text-sm text-ink-gray-5">{t(locale, "Monitoring is available to administrators and managers only.")}</p>
    </div>
  );
}
