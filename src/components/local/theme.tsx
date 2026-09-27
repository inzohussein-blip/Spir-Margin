"use client";

import { useEffect, useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

/**
 * The web app's look: follows the device (auto), or light, or dark — kept
 * per browser. Dark rests the eyes on night shifts; printing stays white.
 */
export type ThemeMode = "auto" | "light" | "dark";
const KEY = "spir.local.theme";
const EVENT = "spir-theme";

function mode(): ThemeMode {
  try { const m = localStorage.getItem(KEY); return m === "light" || m === "dark" ? m : "auto"; } catch { return "auto"; }
}
function apply() {
  const m = mode();
  const dark = m === "dark" || (m === "auto" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Mounted once by the app: applies the choice, follows the device while on auto. */
export function ThemeApplier() {
  useEffect(() => {
    apply();
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    window.addEventListener(EVENT, apply);
    mq?.addEventListener?.("change", apply);
    return () => { window.removeEventListener(EVENT, apply); mq?.removeEventListener?.("change", apply); document.documentElement.classList.remove("dark"); };
  }, []);
  return null;
}

export function ThemeSwitch() {
  const locale = useLocale();
  const [m, setM] = useState<ThemeMode>("auto");
  useEffect(() => setM(mode()), []);
  const pick = (v: ThemeMode) => {
    try { if (v === "auto") localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); } catch { /* ignore */ }
    setM(v);
    window.dispatchEvent(new Event(EVENT));
  };
  const opts: { v: ThemeMode; label: string; Icon: typeof SunIcon }[] = [
    { v: "auto", label: "Like the device", Icon: MonitorIcon },
    { v: "light", label: "Light", Icon: SunIcon },
    { v: "dark", label: "Dark", Icon: MoonIcon },
  ];
  return (
    <div role="radiogroup" aria-label={t(locale, "Appearance")} className="inline-flex flex-wrap gap-1 rounded-xl border border-outline-gray-2 bg-surface-gray-1 p-1" data-testid="theme">
      {opts.map(({ v, label, Icon }) => (
        <button key={v} type="button" role="radio" aria-checked={m === v} data-theme-mode={v} onClick={() => pick(v)}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${m === v ? "bg-brand font-semibold text-white" : "text-ink-gray-6 hover:bg-surface-white"}`}>
          <Icon size={15} /> {t(locale, label)}
        </button>
      ))}
    </div>
  );
}
