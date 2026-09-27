"use client";

import { useEffect, useState } from "react";
import { CheckCircle2Icon, CloudDownloadIcon, RefreshCwIcon, XIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/**
 * The web app settles in this browser once (public/offline-sw.js, prepare):
 * on the first open with the internet the whole app is downloaded — with its
 * progress shown here — and from then on it opens without the internet. While
 * it is open it looks for a new release now and then (on opening, every 30
 * minutes, when the connection comes back); a release is downloaded in the
 * background and offered as a reload.
 */

const RECHECK_MS = 30 * 60_000;
const RETRY_MS = [15_000, 60_000, 5 * 60_000];
export const APP_READY_KEY = "spir.app.ready";
export const APP_EVENT = "spir-app-status";

type State =
  | { kind: "idle" }
  | { kind: "progress"; done: number; total: number }
  | { kind: "installed" }
  | { kind: "update" }
  | { kind: "refreshed" }
  | { kind: "error" };

/** Ask the worker to prepare (or refresh) the app's saved copy now. */
export async function checkForUpdate(): Promise<void> {
  try {
    const reg = await navigator.serviceWorker?.ready;
    reg?.update().catch(() => undefined);
    reg?.active?.postMessage({ type: "spir-prepare" });
  } catch { /* no worker: the app still works online */ }
}

/** Every script this page runs, to tell whether a release is the one already open. */
const ownScripts = () => new Set(Array.from(document.scripts).map((s) => (s.src ? new URL(s.src).pathname : "")).filter((p) => p.startsWith("/_next/static/")));

export function AppInstall() {
  const locale = useLocale();
  const T = (k: string) => t(locale, k);
  const [st, setSt] = useState<State>({ kind: "idle" });

  useEffect(() => {
    // Keep this site's data (the company's records) when the disk runs low.
    void (async () => {
      try { if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist(); } catch { /* unsupported */ }
    })();
    if (!("serviceWorker" in navigator)) return;
    let alive = true;
    let tries = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => timers.push(setTimeout(() => alive && fn(), ms));
    const retry = () => { if (tries < RETRY_MS.length) later(() => void check(), RETRY_MS[tries++]); };
    const check = async () => { if (alive && navigator.onLine) await checkForUpdate(); };

    const onMsg = (e: MessageEvent) => {
      const d = e.data as { type?: string; status?: string; done?: number; total?: number; at?: number; scripts?: string[] } | null;
      if (!alive || d?.type !== "spir-app") return;
      if (d.at) {
        try { localStorage.setItem(APP_READY_KEY, String(d.at)); } catch { /* ignore */ }
        window.dispatchEvent(new Event(APP_EVENT));
      }
      switch (d.status) {
        case "progress": setSt({ kind: "progress", done: d.done ?? 0, total: d.total ?? 1 }); break;
        case "installed":
          tries = 0;
          setSt({ kind: "installed" });
          later(() => setSt((s) => (s.kind === "installed" ? { kind: "idle" } : s)), 7000);
          break;
        case "updated": {
          tries = 0;
          const mine = ownScripts();
          const same = (d.scripts ?? []).filter((s) => s.endsWith(".js")).every((s) => mine.has(s)) && mine.size > 0;
          setSt(same ? { kind: "refreshed" } : { kind: "update" });
          if (same) later(() => setSt((s) => (s.kind === "refreshed" ? { kind: "idle" } : s)), 6000);
          break;
        }
        case "error": setSt((s) => (s.kind === "progress" ? { kind: "error" } : s)); retry(); break;
        case "offline": retry(); break;
        default: setSt((s) => (s.kind === "progress" ? { kind: "idle" } : s));
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    void navigator.serviceWorker.ready.then(() => check());
    const every = setInterval(() => void check(), RECHECK_MS);
    window.addEventListener("online", check);
    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      clearInterval(every);
      window.removeEventListener("online", check);
      navigator.serviceWorker.removeEventListener("message", onMsg);
    };
  }, []);

  if (st.kind === "idle") return null;
  const box = "no-print fixed bottom-4 start-4 z-[70] w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-outline-gray-2 bg-surface-white p-4 text-sm shadow-xl";
  if (st.kind === "progress") {
    const pct = Math.round((st.done / Math.max(1, st.total)) * 100);
    return (
      <div className={box} role="status" data-testid="app-install" data-state="progress">
        <div className="flex items-center gap-2 font-semibold text-ink-gray-8"><CloudDownloadIcon size={16} className="text-brand" /> {T("Preparing to work without the internet…")}</div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-gray-2"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="mt-1 text-xs text-ink-gray-5">{T("Once only")} — <span dir="ltr" className="tabular-nums">{st.done} / {st.total}</span></div>
      </div>
    );
  }
  if (st.kind === "installed" || st.kind === "refreshed") {
    return (
      <div className={box} role="status" data-testid="app-install" data-state={st.kind}>
        <div className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle2Icon size={16} /> {T(st.kind === "installed" ? "Ready to work without the internet" : "Updated to the newest version")}</div>
        <div className="mt-1 text-xs text-ink-gray-5">{T(st.kind === "installed" ? "The whole program is saved in this browser: from now on it opens here even without the internet." : "The copy saved for working offline was updated too.")}</div>
      </div>
    );
  }
  if (st.kind === "error") {
    return (
      <div className={box} role="status" data-testid="app-install" data-state="error">
        <div className="font-semibold text-amber-700">{T("Saving for offline use did not finish")}</div>
        <div className="mt-1 text-xs text-ink-gray-5">{T("It is tried again by itself while the internet is there.")}</div>
      </div>
    );
  }
  return (
    <div className={box} role="status" data-testid="app-install" data-state="update">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold text-ink-gray-8"><RefreshCwIcon size={16} className="text-brand" /> {T("A new version is ready")}</div>
        <button onClick={() => setSt({ kind: "idle" })} aria-label={T("Later")} className="grid size-7 place-items-center rounded-lg text-ink-gray-5 hover:bg-surface-gray-1"><XIcon size={15} /></button>
      </div>
      <div className="mt-1 text-xs text-ink-gray-5">{T("It is already saved in this browser. Reload to use it, or it opens by itself next time.")}</div>
      <button onClick={() => location.reload()} className="mt-3 rounded-lg bg-brand px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-brand-dark">{T("Reload now")}</button>
    </div>
  );
}
