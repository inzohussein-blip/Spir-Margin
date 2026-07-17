"use client";

import { GlobeIcon } from "lucide-react";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  function switchTo(next: Locale) {
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}`;
    window.location.reload();
  }
  const next: Locale = locale === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      onClick={() => switchTo(next)}
      title={locale === "ar" ? "Switch to English" : "التبديل إلى العربية"}
      className="inline-flex items-center gap-1 rounded-md border border-outline-gray-2 px-2.5 py-1.5 text-xs font-medium text-ink-gray-6 hover:bg-surface-gray-1"
    >
      <GlobeIcon size={14} />
      {locale === "ar" ? "EN" : "ع"}
    </button>
  );
}
