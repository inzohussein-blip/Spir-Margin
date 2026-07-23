import "server-only";

/**
 * In-memory login throttle: after too many failed attempts for an email within
 * a window, further attempts are locked out for a cooldown. This blunts
 * password brute-forcing. State lives on globalThis so it survives Next's
 * module reloads (and is shared within the single server process).
 *
 * Note: this is per-process. A multi-instance deployment would want a shared
 * store (DB/Redis); for the embedded single-process deployment this is enough.
 */

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000; // failures counted within 15 minutes
const LOCK_MS = 15 * 60 * 1000; // lock duration after hitting the limit

interface Entry {
  fails: number;
  first: number;
  lockedUntil: number;
}

const g = globalThis as unknown as { __spirLoginAttempts?: Map<string, Entry> };
const attempts: Map<string, Entry> = (g.__spirLoginAttempts ??= new Map());

/** Seconds remaining on a lockout for this key, or 0 if not locked. */
export function lockoutRemaining(key: string): number {
  const e = attempts.get(key.toLowerCase());
  if (!e) return 0;
  const left = e.lockedUntil - Date.now();
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

/** Record a failed attempt; locks the key once the limit is hit. */
export function recordFailure(key: string): void {
  const k = key.toLowerCase();
  const now = Date.now();
  const e = attempts.get(k);
  if (!e || now - e.first > WINDOW_MS) {
    attempts.set(k, { fails: 1, first: now, lockedUntil: 0 });
    return;
  }
  e.fails += 1;
  if (e.fails >= MAX_FAILS) e.lockedUntil = now + LOCK_MS;
}

/** Clear the counter for a key after a successful sign-in. */
export function recordSuccess(key: string): void {
  attempts.delete(key.toLowerCase());
}
