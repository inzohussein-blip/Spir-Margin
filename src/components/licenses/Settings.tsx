"use client";

import { useState } from "react";
import { BugIcon, SlidersHorizontalIcon, Trash2Icon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { Card, StationChips, api, fmtTime } from "./parts";

/**
 * The code manager's general settings (what the web app offers: self-
 * registration with its trial, the error log, when a code counts as ending
 * soon) and the error log itself.
 */

export interface Prefs { selfSignup: boolean; signupModules: string[]; signupSeats: number; errorLog: boolean; warnDays: number }
export interface ErrorEntry { at: number; license_id: string; company: string; device: string; path: string; message: string; agent: string }

export function SettingsSection({ prefs, trialDays, onSaved, onError }: { prefs: Prefs; trialDays: number; onSaved: () => void; onError: (r: Record<string, unknown>) => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [p, setP] = useState(prefs);
  const num = "w-24 rounded-lg border border-outline-gray-2 px-2 py-1.5 text-sm tabular-nums";
  return (
    <Card icon={<SlidersHorizontalIcon size={18} />} title={T("General settings")}>
      <div className="space-y-4" data-testid="prefs">
        <label className="flex items-start gap-2 rounded-lg border border-outline-gray-2 p-3 text-sm">
          <input type="checkbox" name="selfSignup" checked={p.selfSignup} onChange={(e) => setP({ ...p, selfSignup: e.target.checked })} className="mt-1 accent-brand" />
          <span>
            <b>{T("Self-registration")}</b>
            <span className="block text-xs text-ink-gray-5">
              {T("A company opens the web app, presses «Try it free», writes its name and phone, and gets a trial code at once. It shows in your list as a trial with «تسجيل ذاتي» in its note.")}
              {" "}{T("Trial days are set in Prices")}: <b className="tabular-nums">{trialDays}</b>
            </span>
          </span>
        </label>
        {p.selfSignup && (
          <div className="space-y-2 rounded-lg bg-surface-gray-1 p-3">
            <div className="text-xs font-semibold text-ink-gray-6">{T("A self-registered trial opens")}</div>
            <StationChips value={p.signupModules} onChange={(m) => setP({ ...p, signupModules: m })} />
            <label className="flex items-center gap-2 text-sm">{T("Computers")}
              <input type="number" name="signupSeats" min={1} max={10} dir="ltr" value={p.signupSeats} onChange={(e) => setP({ ...p, signupSeats: Number(e.target.value) })} className={num} />
            </label>
          </div>
        )}
        <label className="flex items-start gap-2 rounded-lg border border-outline-gray-2 p-3 text-sm">
          <input type="checkbox" name="errorLog" checked={p.errorLog} onChange={(e) => setP({ ...p, errorLog: e.target.checked })} className="mt-1 accent-brand" />
          <span>
            <b>{T("Error log")}</b>
            <span className="block text-xs text-ink-gray-5">{T("Errors in the web app are kept here with the company and the page (never their records), so you can help before they call.")}</span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          {T("A code counts as ending soon this many days before its end")}
          <input type="number" name="warnDays" min={1} max={90} dir="ltr" value={p.warnDays} onChange={(e) => setP({ ...p, warnDays: Number(e.target.value) })} className={num} />
        </label>
        <button data-testid="save-prefs" onClick={async () => { const r = await api({ op: "prefs", prefs: p }); if (!r.ok) return onError(r); onSaved(); }}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">{T("Save")}</button>
      </div>
    </Card>
  );
}

export function ErrorsSection({ on, errors, onCleared }: { on: boolean; errors: ErrorEntry[]; onCleared: () => void }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  return (
    <Card icon={<BugIcon size={18} />} title={T("Error log")}>
      {!on && <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{T("The error log is off: switch it on in General settings.")}</p>}
      {errors.length === 0 ? <p className="text-sm text-ink-gray-5">{T("No errors")}</p> : (
        <>
          <div className="max-h-[32rem] overflow-y-auto">
            <table className="w-full text-xs" data-testid="errors">
              <thead className="text-ink-gray-5"><tr><th className="py-1 text-start font-medium">{T("When")}</th><th className="py-1 text-start font-medium">{T("Company")}</th><th className="py-1 text-start font-medium">{T("Page")}</th><th className="py-1 text-start font-medium">{T("Error")}</th></tr></thead>
              <tbody className="divide-y divide-outline-gray-1">
                {errors.map((e, i) => (
                  <tr key={i}>
                    <td dir="ltr" className="whitespace-nowrap py-1 text-start tabular-nums text-ink-gray-5">{fmtTime(e.at)}</td>
                    <td className="py-1 text-ink-gray-7">{e.company || "—"}</td>
                    <td dir="ltr" className="py-1 text-start font-mono text-ink-gray-5">{e.path || "—"}</td>
                    <td dir="auto" className="py-1 text-ink-gray-7" title={e.agent}>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button onClick={async () => { if (!window.confirm(T("Clear the error log?"))) return; await api({ op: "errors_clear" }); onCleared(); }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"><Trash2Icon size={14} /> {T("Clear")}</button>
        </>
      )}
    </Card>
  );
}
