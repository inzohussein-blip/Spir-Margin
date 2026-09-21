"use client";

import { useEffect, useState } from "react";
import { Rows3Icon, Rows4Icon } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { t } from "@/lib/i18n";

type Density = "comfortable" | "compact";
const KEY = "spir_density";

/**
 * Comfortable / compact row height for list tables.
 *
 * Writes `data-density` on <html>; the padding rules live in globals.css so
 * the switch costs one attribute and applies to every list at once. The
 * choice is a per-browser convenience, so localStorage is the right home for
 * it — it never needs to reach the server or another device.
 */
export function DensityToggle() {
  const locale = useLocale();
  const [density, setDensity] = useState<Density>("comfortable");

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(KEY);
    } catch {
      /* private mode / blocked storage — fall back to the default */
    }
    if (saved === "compact") {
      setDensity("compact");
      document.documentElement.setAttribute("data-density", "compact");
    }
  }, []);

  function toggle() {
    const next: Density = density === "compact" ? "comfortable" : "compact";
    setDensity(next);
    document.documentElement.setAttribute("data-density", next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* not persisting is acceptable; the session still reflects the choice */
    }
  }

  const compact = density === "compact";
  const label = compact ? t(locale, "Comfortable rows") : t(locale, "Compact rows");

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      aria-pressed={compact}
      className="hidden items-center gap-1.5 rounded-md border border-outline-gray-2 px-2.5 py-1.5 text-xs font-medium text-ink-gray-6 transition-colors hover:bg-surface-gray-1 sm:inline-flex"
    >
      {compact ? <Rows3Icon size={14} /> : <Rows4Icon size={14} />}
    </button>
  );
}
