import { AlertTriangleIcon, HardDriveIcon } from "lucide-react";
import { Panel, EmptyRow } from "@/components/dashboard/Panel";
import { StatCard } from "@/components/dashboard/StatCard";
import { syncDetail } from "@/lib/sync/engine";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { t, type Locale } from "@/lib/i18n";

const OP_LABEL: Record<string, string> = { I: "Created", U: "Changed", D: "Deleted" };
const OP_STYLE: Record<string, string> = {
  I: "bg-emerald-100 text-emerald-700",
  U: "bg-amber-100 text-amber-700",
  D: "bg-red-100 text-red-700",
};

/**
 * Database sync, for the monitoring page.
 *
 * The panel below it covers the BROWSER's queue — sales submitted while the
 * page could not reach the server. This one covers the other axis: whether
 * this machine's database has reached the hosted one. They are different
 * failures with different fixes, so they are reported separately rather than
 * added into one number that hides both.
 */
export async function DatabaseSyncPanel({ locale }: { locale: Locale }) {
  const d = await syncDetail();

  if (!d.configured) {
    return (
      <Panel title={t(locale, "Database sync")}>
        <div className="flex items-start gap-3 p-4 text-sm text-ink-gray-6">
          <HardDriveIcon size={18} className="mt-0.5 shrink-0 text-ink-gray-4" />
          <div>
            <div className="font-medium text-ink-gray-8">{t(locale, "This computer only")}</div>
            <p className="mt-1 leading-relaxed">
              {t(
                locale,
                "No hosted database is configured, so there is nothing to sync with. Everything is stored here, and the changes below are kept ready in case one is added later.",
              )}
            </p>
            <p className="mt-2 text-xs text-ink-gray-5">
              {t(locale, "Changes recorded on this computer")}: <span className="font-semibold tabular-nums">{fmtNum(d.logged)}</span>
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard
          label={t(locale, "Waiting to be sent")}
          value={fmtNum(d.pending)}
          accent={d.pending ? "amber" : "green"}
        />
        <StatCard label={t(locale, "Changes recorded")} value={fmtNum(d.logged)} accent="brand" />
        <StatCard
          label={t(locale, "Last database sync")}
          value={d.lastSyncAt ? fmtDateTime(d.lastSyncAt) : "—"}
          accent="brand"
        />
        <StatCard
          label={t(locale, "Oldest waiting change")}
          value={d.oldestPending ? fmtDateTime(d.oldestPending) : "—"}
          accent={d.oldestPending ? "amber" : "green"}
        />
      </div>

      {d.lastError ? (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangleIcon size={16} className="mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">{t(locale, "Last sync failed")}</div>
            <p className="mt-0.5 break-words">{d.lastError}</p>
            <p className="mt-1 text-xs">
              {t(locale, "Nothing is lost — the work stays on this computer and the next sync tries again.")}
            </p>
          </div>
        </div>
      ) : null}

      <Panel
        title={`${t(locale, "Still only on this computer")} (${fmtNum(d.pending)})`}
      >
        {d.waiting.length === 0 ? (
          <EmptyRow
            text={
              d.pending === 0
                ? t(locale, "Everything on this computer has reached the hosted database.")
                : t(locale, "No details available.")
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-start text-xs uppercase text-ink-gray-4">
                  <th className="px-4 py-2">{t(locale, "When")}</th>
                  <th className="px-4 py-2">{t(locale, "Record")}</th>
                  <th className="px-4 py-2">{t(locale, "Change")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-gray-1">
                {d.waiting.map((w, i) => (
                  <tr key={i} className="hover:bg-surface-gray-1">
                    <td className="whitespace-nowrap px-4 py-2 text-ink-gray-5">{fmtDateTime(w.at)}</td>
                    <td className="px-4 py-2 font-medium">{t(locale, w.table)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${OP_STYLE[w.op] ?? "bg-surface-gray-2"}`}>
                        {t(locale, OP_LABEL[w.op] ?? w.op)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
