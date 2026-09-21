/**
 * Canonical number and date formatting.
 *
 * The UI is Arabic, but digits are always Western Arabic numerals (1234),
 * never Arabic-Indic (١٢٣٤). A bare, locale-less `toLocaleString()` does NOT
 * give that: with no locale argument it follows the *visitor's browser* locale on
 * the client and Node's on the server, so a visitor whose browser is set to
 * ar-EG or ar-SA would see ١٢٣٤ — and the server/client mismatch also breaks
 * hydration. Every call site therefore goes through these helpers, which pin
 * the locale explicitly.
 *
 * `NUM_LOCALE` is the single place to change if the digit style ever should.
 */
export const NUM_LOCALE = "en-US";

/** Grouped number: 1,234.5 */
export function fmtNum(
  value: number | string | null | undefined,
  opts: Intl.NumberFormatOptions = {},
): string {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat(NUM_LOCALE, opts).format(Number.isFinite(n as number) ? (n as number) : 0);
}

/** Money with a currency symbol: $1,234 */
export function fmtMoney(
  value: number | string | null | undefined,
  currency = "USD",
  opts: Intl.NumberFormatOptions = {},
): string {
  return fmtNum(value, { style: "currency", currency, maximumFractionDigits: 0, ...opts });
}

/** Date as YYYY-MM-DD, stable on both server and client. */
export function fmtDate(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(NUM_LOCALE, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Time of day: 14:05 */
export function fmtTime(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat(NUM_LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/** Date and time together. */
export function fmtDateTime(value: string | number | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${fmtDate(d)} ${fmtTime(d)}`;
}
