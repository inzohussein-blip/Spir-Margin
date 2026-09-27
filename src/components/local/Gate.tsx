"use client";

import { useState, type ReactNode } from "react";
import { KeyRoundIcon, LockIcon, LoaderIcon, RefreshCwIcon, AlertTriangleIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";
import type { LocalRuntime } from "@/lib/local/runtime";

/** The screens before the app: starting, the code, signing in, locked, failed. */

function Frame({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center bg-surface-gray-1 p-4">
      <div className="w-full max-w-md rounded-2xl border border-outline-gray-2 bg-surface-white p-7 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand-dark text-white shadow-sm">{icon}</span>
          <div>
            <div className="text-xs text-ink-gray-5">Spir-Margin</div>
            <h1 className="text-lg font-bold text-ink-gray-9">{title}</h1>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

const STEP: Record<string, string> = {
  engine: "Loading the database engine…",
  schema: "Preparing the database on this browser…",
};

export function Booting({ rt }: { rt: LocalRuntime }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const text = rt.phase === "first_sync" ? T("Bringing your company's records…") : T(STEP[rt.progress] ?? "Starting…");
  return (
    <Frame icon={<LoaderIcon size={20} className="animate-spin" />} title={T("Web app")}>
      <p data-testid="local-boot" className="text-sm text-ink-gray-6">{text}</p>
      <p className="mt-2 text-xs text-ink-gray-5">{T("The first time takes a little longer: the app settles in this browser, then opens here even without the internet.")}</p>
    </Frame>
  );
}

const ACTIVATE_ERROR: Record<string, string> = {
  not_found: "That code is not right.",
  seats_full: "This code is already used on all the devices it allows.",
  stopped: "This code has been stopped. Contact the provider.",
  expired: "This code has expired. Contact the provider.",
  too_many: "Too many attempts — wait a few minutes.",
  offline: "The first activation needs the internet.",
  disabled: "Activation codes are not available on this site.",
  error: "Could not activate. Try again.",
};

export function Activate({ rt }: { rt: LocalRuntime }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Frame icon={<KeyRoundIcon size={20} />} title={T("Activate the web app")}>
      <p className="text-sm leading-relaxed text-ink-gray-6">
        {T("Enter your company's activation code once. The app then settles in this browser and works with the internet or without it; what you do offline is sent when the connection returns.")}
      </p>
      <form data-testid="local-activate" className="mt-4 space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setErr("");
        const r = await rt.activate(code);
        setBusy(false);
        if (!r.ok) setErr(T(ACTIVATE_ERROR[r.error] ?? ACTIVATE_ERROR.error));
      }}>
        <input name="code" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" autoFocus placeholder="XXXX-XXXX-XXXX"
          className="w-full rounded-lg border border-outline-gray-2 px-3 py-2.5 text-center font-mono tracking-widest outline-none focus:border-brand" />
        <button disabled={busy || code.trim().length < 8} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          {busy ? T("Activating…") : T("Activate")}
        </button>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </form>
    </Frame>
  );
}

export function SignIn({ rt }: { rt: LocalRuntime }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [mode, setMode] = useState<"code" | "account">("code");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const cls = "w-full rounded-lg border border-outline-gray-2 px-3 py-2.5 text-sm outline-none focus:border-brand";
  return (
    <Frame icon={<KeyRoundIcon size={20} />} title={rt.license?.company || T("Sign in")}>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-surface-gray-1 p-1 text-sm">
        {(["code", "account"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setErr(""); }} aria-pressed={mode === m}
            className={`rounded-md px-3 py-1.5 ${mode === m ? "bg-surface-white font-semibold shadow-sm" : "text-ink-gray-6"}`}>
            {T(m === "code" ? "The activation code" : "My account")}
          </button>
        ))}
      </div>
      <form data-testid="local-sign-in" className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true); setErr("");
        const ok = mode === "code" ? await rt.signInWithCode(code) : await rt.signIn(email, password);
        setBusy(false);
        if (!ok) setErr(T(mode === "code" ? "This is not this company's activation code." : "Invalid email or password"));
      }}>
        {mode === "code" ? (
          <input name="code" value={code} onChange={(e) => setCode(e.target.value)} dir="ltr" autoFocus placeholder="XXXX-XXXX-XXXX" className={`${cls} text-center font-mono tracking-widest`} />
        ) : (
          <>
            <input name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" placeholder={T("Email")} className={cls} />
            <input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={T("Password")} className={cls} />
          </>
        )}
        <button disabled={busy} className="w-full rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
          {busy ? T("Checking…") : T("Sign in")}
        </button>
        {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      </form>
      <p className="mt-4 text-xs text-ink-gray-5">{T("Signing in is checked on this browser: it works without the internet too.")}</p>
    </Frame>
  );
}

const LOCK_REASON: Record<string, string> = {
  expired: "The activation code has expired.",
  stopped: "The activation code has been stopped by the provider.",
  gone: "This browser no longer holds a seat in the code.",
  clock: "This device's date or clock is wrong. Correct it, then press «Check now».",
  offline: "This browser has not reached the site for longer than your code allows. Connect it to the internet, then press «Check now».",
};

export function Locked({ rt }: { rt: LocalRuntime }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const reason = rt.state.kind === "locked" ? rt.state.reason : "gone";
  const [busy, setBusy] = useState(false);
  return (
    <Frame icon={<LockIcon size={20} />} title={T("The web app is locked")}>
      <p data-reason={reason} className="text-sm text-ink-gray-6">{T(LOCK_REASON[reason] ?? LOCK_REASON.gone)}</p>
      <p className="mt-2 text-xs text-ink-gray-5">{T("Your records stay in this browser and come back when the code is renewed.")}</p>
      <button disabled={busy} onClick={async () => {
        setBusy(true);
        try { localStorage.removeItem(`spir.local.blocked.${rt.license?.lid}`); } catch { /* ignore */ }
        await rt.checkLicense();
        await rt.start();
        setBusy(false);
      }} className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">
        <RefreshCwIcon size={14} className={busy ? "animate-spin" : ""} /> {T("Check now")}
      </button>
    </Frame>
  );
}

export function Failed({ rt }: { rt: LocalRuntime }) {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  return (
    <Frame icon={<AlertTriangleIcon size={20} />} title={T("The web app could not start")}>
      <p className="text-sm text-ink-gray-6">{T("This browser may be in private mode or out of storage space. Try again, or open the app in a normal window.")}</p>
      <p dir="ltr" className="mt-2 break-all rounded bg-surface-gray-1 p-2 font-mono text-xs text-ink-gray-5">{rt.failure}</p>
      <button onClick={() => void rt.start()} className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">{T("Try again")}</button>
    </Frame>
  );
}
