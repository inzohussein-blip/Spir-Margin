"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";

const LocaleCtx = createContext<Locale>(DEFAULT_LOCALE);

/** Provides the current UI locale to client components (set once in the layout). */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleCtx.Provider value={locale}>{children}</LocaleCtx.Provider>;
}

/** Current locale inside client components (matches the server-rendered value). */
export function useLocale(): Locale {
  return useContext(LocaleCtx);
}
