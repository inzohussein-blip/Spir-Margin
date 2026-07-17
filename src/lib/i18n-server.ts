import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, DEFAULT_LOCALE, type Locale } from "./i18n";

/** Current UI locale from the cookie (defaults to Arabic). */
export function getLocale(): Locale {
  const v = cookies().get(LOCALE_COOKIE)?.value;
  return v === "en" ? "en" : DEFAULT_LOCALE;
}
