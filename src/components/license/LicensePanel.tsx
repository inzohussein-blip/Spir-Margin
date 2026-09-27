"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { KeyRoundIcon, LockIcon, ClockIcon, RefreshCwIcon, WifiOffIcon, XIcon, MessageSquareIcon, ShieldCheckIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import { activateLicenseAction, recheckLicenseAction, type ActivateState } from "@/app/actions/license";
import type { DeviceState } from "@/lib/license/state";

/**
 * The activation window over the welcome page («تسجيل الرمز»).
 *
 *  - no code yet → the window cannot be closed: enter the company's code once
 *    (it needs the internet this one time);
 *  - expired / stopped / moved / grace over / clock turned back → locked, with
 *    "check now" for a renewal made by the provider;
 *  - `?license=1` → the code's status, and a place to enter a new one;
 *  - ending within 14 days, the grace period, a message from the provider →
 *    a small notice at the bottom; the app stays usable.
 */

const HIDE_KEY = "spir.license.noticeHidden";
const MSG_KEY = "spir.license.messageSeen";
const DAY = 86_400_000;
const fmt = (ms?: number) => (ms ? new Date(ms).toLocaleDateString("en-CA") : "");

function Submit({ label }: { label: string }) {
  const { pending } = useFormStatus();
  const locale = useLocale();
  return (
    <button disabled={pending} className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
      <KeyRoundIcon size={16} /> {pending ? t(locale, "Checking…") : label}
    </button>
  );
}

function CodeForm({ cta }: { cta: string }) {
  const locale = useLocale();
  const router = useRouter();
  const [state, action] = useFormState<ActivateState | null, FormData>(activateLicenseAction, null);
  const [code, setCode] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { setTimeout(() => ref.current?.focus(), 50); }, []);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={action} data-testid="code-form">
      <input ref={ref} name="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
        autoComplete="off" spellCheck={false} dir="ltr" placeholder="XXXX-XXXX-XXXX" aria-label={t(locale, "Activation code")}
        className={`w-full rounded-lg border bg-surface-white px-3 py-2.5 text-center font-mono text-base tracking-widest outline-none focus:border-brand ${state?.error ? "border-red-400" : "border-outline-gray-2"}`} />
      <Submit label={cta} />
      {state?.error && <p role="alert" className="mt-2 text-xs text-red-600">{t(locale, state.error)}</p>}
      {state?.ok && <p className="mt-2 text-xs text-emerald-700">{t(locale, "Activated.")}</p>}
    </form>
  );
}

function Screen({ icon, title, contact, children, onClose }: { icon: ReactNode; title: string; contact: string; children: ReactNode; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-900/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={title} data-testid="license-window">
      <div className="relative w-full max-w-sm rounded-2xl border border-outline-gray-2 bg-surface-white p-6 text-center shadow-xl">
        {onClose && (
          <button onClick={onClose} aria-label="×" className="absolute end-3 top-3 grid size-7 place-items-center rounded-md text-ink-gray-5 hover:bg-surface-gray-1"><XIcon size={15} /></button>
        )}
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-brand-light text-brand-dark">{icon}</span>
        <div className="mt-3 text-lg font-bold text-ink-gray-9">{title}</div>
        {children}
        {contact && <p className="mt-4 border-t border-outline-gray-2 pt-3 text-xs text-ink-gray-5" dir="auto">{contact}</p>}
      </div>
    </div>
  );
}

function CheckNow() {
  const locale = useLocale();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => { await recheckLicenseAction(); router.refresh(); })}
      className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-outline-gray-2 px-4 py-2 text-sm hover:bg-surface-gray-1 disabled:opacity-60">
      <RefreshCwIcon size={15} className={pending ? "animate-spin" : ""} /> {t(locale, "Check now")}
    </button>
  );
}

export function LicensePanel({ state, contact, message, showStatus, now }: {
  state: DeviceState; contact: string; message: string; showStatus: boolean; now: number;
}) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [open, setOpen] = useState(showStatus);
  const [hidden, setHidden] = useState(true);
  const [msg, setMsg] = useState("");
  const [online, setOnline] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem(HIDE_KEY) === new Date().toLocaleDateString("en-CA")); } catch { setHidden(false); }
    try { setMsg(message && localStorage.getItem(MSG_KEY) !== message ? message : ""); } catch { setMsg(message); }
    setOnline(navigator.onLine);
  }, [message]);

  if (state.kind === "off") return null;

  if (state.kind === "need") {
    return (
      <Screen icon={<LockIcon size={22} />} title={T("Activate this computer")} contact={contact}>
        <p className="mb-4 mt-1 text-sm text-ink-gray-6">{T("Enter your company's activation code. It is asked once on this computer and needs the internet this one time; after that everything works offline.")}</p>
        <CodeForm cta={T("Activate")} />
        {!online && <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700"><WifiOffIcon size={13} /> {T("No internet connection right now.")}</p>}
      </Screen>
    );
  }

  if (state.kind === "locked") {
    const why = {
      expired: `${T("The activation code of")} «${state.company}» ${T("ended on")} ${fmt(state.until)}.`,
      stopped: `${T("The activation code of")} «${state.company}» ${T("is stopped.")}`,
      gone: T("This computer's code is no longer valid (its seat was freed, or the code was replaced or deleted)."),
      grace_over: T("The 30 days this computer could run without a code are over."),
      clock: T("This computer's date or clock is wrong. Correct it, then press «Check now»."),
    }[state.reason];
    return (
      <Screen icon={state.reason === "clock" ? <ClockIcon size={22} /> : <LockIcon size={22} />} title={T("This computer is locked")} contact={contact}>
        <p className="mb-1 mt-1 text-sm text-ink-gray-6" data-reason={state.reason}>{why}</p>
        <p className="mb-4 text-xs text-ink-gray-5">{T("The company's records are safe on this computer and come back in full once the code runs again.")}</p>
        {state.reason !== "clock" && <CodeForm cta={T("Enter a new code")} />}
        <CheckNow />
      </Screen>
    );
  }

  const left = Math.ceil((state.until - now) / DAY);
  const notice =
    state.kind === "grace" ? `${T("This computer runs without a code until")} ${fmt(state.until)} (${left} ${T("days")}) — ${T("enter your company's code before then.")}`
    : left <= 14 ? `${T("The activation code of")} «${state.company}» ${T("ends in")} ${left} ${T("days")} (${fmt(state.until)}) — ${T("contact the provider to renew it.")}`
    : "";
  const hideToday = () => { try { localStorage.setItem(HIDE_KEY, new Date().toLocaleDateString("en-CA")); } catch { /* ignore */ } setHidden(true); };
  const seen = () => { try { localStorage.setItem(MSG_KEY, msg); } catch { /* ignore */ } setMsg(""); };

  return (
    <>
      {open && (
        <Screen icon={<ShieldCheckIcon size={22} />} title={T("This computer's activation code")} contact={contact} onClose={() => setOpen(false)}>
          <div className="mt-2 space-y-1 text-sm text-ink-gray-7" data-testid="license-status">
            {state.kind === "ok" ? (
              <>
                <div className="font-semibold">{state.company}</div>
                <div>{T("until")} {fmt(state.until)} ({left} {T("days")})</div>
                <div>{T("Computers")}: {state.seats}</div>
              </>
            ) : <div>{notice}</div>}
          </div>
          <p className="mb-3 mt-4 text-xs text-ink-gray-5">{T("A new code from the provider (a renewal, more stations) goes here.")}</p>
          <CodeForm cta={T("Enter a new code")} />
          <CheckNow />
        </Screen>
      )}
      {msg && !open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[80] flex justify-center p-3">
          <div className="pointer-events-auto flex max-w-2xl items-start gap-2 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2 text-xs text-sky-900 shadow-lg" data-testid="provider-message">
            <MessageSquareIcon size={15} className="mt-0.5 shrink-0" />
            <span className="flex-1" dir="auto"><b>{T("Message from the provider")}:</b> {msg}</span>
            <button onClick={seen} className="rounded-md bg-sky-600 px-2 py-1 font-semibold text-white hover:bg-sky-700">{T("Got it")}</button>
          </div>
        </div>
      )}
      {notice && !hidden && !open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[80] flex justify-center p-3">
          <div className="pointer-events-auto flex max-w-2xl flex-wrap items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 shadow-lg" data-testid="license-notice">
            <ClockIcon size={15} className="shrink-0" />
            <span className="flex-1">{notice}</span>
            <button onClick={() => setOpen(true)} className="rounded-md bg-amber-600 px-2 py-1 font-semibold text-white hover:bg-amber-700">{T("Activation code")}</button>
            <button onClick={hideToday} aria-label={T("Hide for today")} title={T("Hide for today")} className="grid size-6 place-items-center rounded-md hover:bg-amber-100"><XIcon size={13} /></button>
          </div>
        </div>
      )}
    </>
  );
}
