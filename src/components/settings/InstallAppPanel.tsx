"use client";

import { useCallback, useEffect, useState } from "react";
import { MonitorDownIcon, CheckCircle2Icon, InfoIcon, Loader2Icon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/** The event the browser hands over; it is not in the DOM lib's types. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

declare global {
  interface Window {
    __spirInstall: InstallPromptEvent | null;
  }
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari predates the standard and reports it here instead.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Install Spir-Margin as an app on this computer.
 *
 * What that actually does is give it its own window and an icon, instead of a
 * browser tab. It does NOT make the app run by itself: the program serving it
 * still has to be running, which is what the note below says rather than
 * leaving someone to discover an empty window later.
 */
export function InstallAppPanel() {
  const locale = useLocale();
  const [available, setAvailable] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    setAvailable(!!window.__spirInstall);
    const onOffer = () => setAvailable(true);
    const onDone = () => {
      setAvailable(false);
      setInstalled(true);
    };
    window.addEventListener("spir-installable", onOffer);
    window.addEventListener("spir-installed", onDone);
    return () => {
      window.removeEventListener("spir-installable", onOffer);
      window.removeEventListener("spir-installed", onDone);
    };
  }, []);

  const install = useCallback(async () => {
    const e = window.__spirInstall;
    if (!e) return;
    setBusy(true);
    try {
      await e.prompt();
      const { outcome } = await e.userChoice;
      if (outcome === "accepted") {
        // `appinstalled` confirms it; clear the offer either way, since the
        // browser will not let the same event be used twice.
        window.__spirInstall = null;
        setAvailable(false);
      }
    } catch {
      /* the person closed the browser's own dialog */
    } finally {
      setBusy(false);
    }
  }, []);

  return (
    <div className="space-y-4 p-5">
      {installed ? (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
          <CheckCircle2Icon size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          <div>
            <div className="font-semibold text-emerald-900">{t(locale, "Installed on this computer")}</div>
            <p className="mt-0.5 text-emerald-800">
              {t(locale, "Spir-Margin is running as its own window. You can open it from the computer like any other program.")}
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-ink-gray-6">
            {t(locale, "Install Spir-Margin so it opens in its own window with its own icon, instead of a browser tab.")}
          </p>

          {available ? (
            <button
              type="button"
              onClick={() => void install()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-brand-dark active:scale-95 disabled:opacity-60"
            >
              {busy ? <Loader2Icon size={15} className="animate-spin" /> : <MonitorDownIcon size={15} />}
              {t(locale, "Install the app")}
            </button>
          ) : (
            <div className="flex items-start gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2.5 text-sm text-ink-gray-6">
              <InfoIcon size={15} className="mt-0.5 shrink-0 text-ink-gray-4" />
              <span>
                {t(locale, "This browser does not offer a one-click install. Use its own menu — look for “Install” or “Add to Home screen”.")}
              </span>
            </div>
          )}
        </>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-outline-gray-2 bg-surface-gray-1 px-3 py-2.5 text-xs leading-relaxed text-ink-gray-6">
        <InfoIcon size={14} className="mt-0.5 shrink-0 text-ink-gray-4" />
        <span>
          {t(locale, "Installing gives the app a window and an icon. Spir-Margin still runs from this computer, so it must be started for the icon to open anything — see the setup guide for starting it automatically.")}
        </span>
      </div>
    </div>
  );
}
