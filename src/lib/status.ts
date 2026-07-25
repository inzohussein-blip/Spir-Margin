import { t, type Locale } from "@/lib/i18n";

/**
 * Human-readable, localized label for a document status. Statuses are stored as
 * lowercase enum values (e.g. "partly_paid"); this normalizes the underscore
 * and runs the phrase through the i18n dictionary, falling back to the spaced
 * English if there is no translation. Colours stay with each page's badge map —
 * this only touches the visible text.
 */
export function statusLabel(locale: Locale, status: string | null | undefined): string {
  if (!status) return "—";
  return t(locale, String(status).replace(/_/g, " "));
}
