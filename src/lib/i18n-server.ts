import "server-only";
import { DEFAULT_LOCALE, type Locale } from "./i18n";

/**
 * Current UI locale.
 *
 * The app is Arabic-only. English is still fully present in `i18n.ts` (the
 * `Locale` type, the dictionary keys, every `t(locale, …)` call site) — it is
 * simply never selected: this always returns Arabic, the language switcher is
 * not rendered, and the `spir_locale` cookie is ignored. Re-enabling English
 * later is a one-line change here plus putting the switcher back in the layout.
 */
export function getLocale(): Locale {
  return DEFAULT_LOCALE;
}
