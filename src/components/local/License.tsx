"use client";

import { useEffect, useState } from "react";
import { BellIcon, CheckCircle2Icon, KeyRoundIcon, LockIcon, RefreshCwIcon, WifiOffIcon, XIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { STATIONS } from "@/lib/license/modules";
import { useRuntime } from "./hooks";
import { Card } from "./parts";

/**
 * The web app's code, in the open: whose it is, until when, which stations
 * it opens, this browser's seat, when it was last checked with the site, and
 * the provider's message — plus the notices shown above every page when the
 * code is ending, when the browser must reach the site soon, or when the
 * provider wrote something.
 */

const DAY = 86_400_000;
const fmtDay = (ms?: number | null) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "—");
const fmtTime = (ms?: number | null) => (ms ? new Date(ms).toLocaleString("en-CA", { hour12: false }).replace(",", "") : "—");
const HIDE_KEY = "spir.local.notice.hidden";
const MSG_KEY = "spir.local.notice.message";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function LicensePage() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime(["license", "sync"]);
  const [busy, setBusy] = useState(false);
  const l = rt.license;
  const s = rt.state;
  if (!l) return null;
  const now = Date.now();
  const left = Math.max(0, Math.ceil((l.until - now) / DAY));
  const ending = left <= rt.site.warnDays;
  const checkBy = s.kind === "ok" ? s.checkBy : undefined;
  const row = (k: string, v: React.ReactNode, testid?: string) => (
    <div className="flex justify-between gap-3 py-1.5"><dt className="text-ink-gray-5">{T(k)}</dt><dd className="text-end" data-testid={testid}>{v}</dd></div>
  );
  return (
    <div className="space-y-4" data-testid="local-license">
      <div className={`rounded-2xl border-2 p-5 ${ending ? "border-amber-300 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`grid size-11 place-items-center rounded-xl text-white ${ending ? "bg-amber-500" : "bg-emerald-600"}`}><KeyRoundIcon size={20} /></span>
            <div>
              <div className="text-lg font-bold text-ink-gray-9">{l.company}</div>
              <div className="text-sm text-ink-gray-6">
                {l.trial ? `${T("Trial")} · ` : ""}{T("until")} <span dir="ltr" className="tabular-nums">{fmtDay(l.until)}</span>
              </div>
            </div>
          </div>
          <div className="text-end">
            <div className={`text-3xl font-bold tabular-nums ${ending ? "text-amber-700" : "text-emerald-700"}`} data-testid="days-left">{left}</div>
            <div className="text-xs text-ink-gray-6">{T("days left")}</div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={T("The stations of your code")}>
          <ul className="grid gap-2 p-4 sm:grid-cols-2" data-testid="license-stations">
            {STATIONS.map((st) => {
              const on = !l.mods.length || l.mods.includes(st.id);
              return (
                <li key={st.id} data-open={on ? "1" : "0"} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${on ? `border-transparent ${st.tone.soft}` : "border-outline-gray-2 text-ink-gray-4"}`}>
                  {on ? <CheckCircle2Icon size={15} /> : <LockIcon size={15} />} {T(st.label)}
                </li>
              );
            })}
          </ul>
        </Card>
        <Card title={T("This browser")} actions={
          <button disabled={busy} onClick={async () => { setBusy(true); await rt.checkLicense(); await rt.refreshSite(); setBusy(false); }}
            className="inline-flex items-center gap-1 rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
            <RefreshCwIcon size={14} className={busy ? "animate-spin" : ""} /> {T("Check now")}
          </button>}>
          <dl className="divide-y divide-outline-gray-1 px-4 py-2 text-sm">
            {row("Computers the code allows", <span className="tabular-nums">{l.seats ?? 1}</span>)}
            {row("This device", <span dir="ltr" className="font-mono text-xs">{l.device.slice(0, 12)}</span>)}
            {row("Last checked with the site", <span dir="ltr" className="tabular-nums" data-testid="checked-at">{fmtTime(l.checkedAt)}</span>)}
            {checkBy && row("Must reach the site by", <span dir="ltr" className="tabular-nums">{fmtDay(checkBy)}</span>)}
            {row("Company database", l.cloud ? T("Linked — syncs through the site") : T("Not linked: the records stay on this browser"))}
          </dl>
          <p className="border-t border-outline-gray-1 px-4 py-3 text-xs leading-relaxed text-ink-gray-5">
            {T("The code is checked here, on this browser, every time the app opens — without the internet too. With the internet the site is asked every few hours for renewals, station changes and messages.")}
          </p>
        </Card>
      </div>

      {l.message && (
        <Card title={T("Message from the provider")}>
          <p className="p-4 text-sm leading-relaxed text-ink-gray-7" dir="auto" data-testid="provider-message">{l.message}</p>
        </Card>
      )}
      {rt.site.contact && <p className="text-center text-sm text-ink-gray-6" dir="auto">{rt.site.contact}</p>}
    </div>
  );
}

/** Above every page: the code ending soon (hidden for the day on request), a check due, the provider's new message. */
export function LicenseNotices() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const rt = useRuntime(["license"]);
  const [hiddenDay, setHiddenDay] = useState<string | null>(null);
  const [seenMsg, setSeenMsg] = useState<string | null>(null);
  useEffect(() => { setHiddenDay(read(HIDE_KEY)); setSeenMsg(read(MSG_KEY)); }, []);
  const l = rt.license;
  if (!l) return null;
  const now = Date.now();
  const today = new Date().toLocaleDateString("en-CA");
  const left = Math.ceil((l.until - now) / DAY);
  const checkBy = rt.state.kind === "ok" ? rt.state.checkBy : undefined;
  const bar = "flex flex-wrap items-center gap-2 border-b px-4 py-2 text-sm";
  const notes: React.ReactNode[] = [];
  if (left <= rt.site.warnDays && hiddenDay !== today) {
    notes.push(
      <div key="ending" data-testid="notice-ending" className={`${bar} border-amber-200 bg-amber-50 text-amber-900`}>
        <BellIcon size={15} />
        <span className="flex-1">{T("The activation code ends in")} <b className="tabular-nums">{Math.max(0, left)}</b> {T("days")} — {T("contact the provider to renew it.")}</span>
        <a href="#/license" className="text-xs font-semibold underline">{T("Details")}</a>
        <button onClick={() => { write(HIDE_KEY, today); setHiddenDay(today); }} className="text-xs underline">{T("Hide today")}</button>
      </div>,
    );
  }
  if (checkBy && checkBy - now <= 3 * DAY) {
    notes.push(
      <div key="check" data-testid="notice-check" className={`${bar} border-orange-200 bg-orange-50 text-orange-900`}>
        <WifiOffIcon size={15} />
        <span className="flex-1">{T("Connect this browser to the internet by")} <b dir="ltr" className="tabular-nums">{fmtDay(checkBy)}</b> {T("so the code can be checked.")}</span>
      </div>,
    );
  }
  if (l.message && seenMsg !== l.message) {
    notes.push(
      <div key="msg" data-testid="notice-message" className={`${bar} border-sky-200 bg-sky-50 text-sky-900`}>
        <BellIcon size={15} />
        <span className="flex-1" dir="auto"><b>{T("Message from the provider")}:</b> {l.message}</span>
        <button aria-label={T("Close")} onClick={() => { write(MSG_KEY, l.message ?? ""); setSeenMsg(l.message ?? ""); }} className="rounded p-1 hover:bg-sky-100"><XIcon size={14} /></button>
      </div>,
    );
  }
  return notes.length ? <div className="no-print">{notes}</div> : null;
}
