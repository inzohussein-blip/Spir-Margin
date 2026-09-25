/**
 * Per-browser memory of small choices (the last warehouse, currency or
 * customer, a list's last filter), so the next form starts where the last
 * one left off. Browser storage can be missing or refused (a private
 * window); then nothing is remembered and nothing breaks.
 */
const PREFIX = "spir.remember.";

export function recall(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function remember(key: string, value: string | null | undefined): void {
  try {
    if (typeof window === "undefined") return;
    if (value) window.localStorage.setItem(PREFIX + key, value);
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* storage refused: nothing to remember */
  }
}
