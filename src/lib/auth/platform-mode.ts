/**
 * Shared platform-mode constants and types.
 *
 * The value tracks which "platform" the visitor chose before signing in:
 *
 *   - "local"     — this app runs entirely on this single computer (embedded
 *                   PGlite Postgres). Accounts and passwords live only on this
 *                   machine and cannot be used from another device.
 *   - "networked" — the app talks to a hosted Postgres/Supabase database, so
 *                   the same account works from any authorized computer.
 *
 * Server components/actions read the cookie via `getPlatformMode()` in
 * `./platform-mode-server`. Middleware reads it from `req.cookies` directly.
 * The cookie is only a UX signal: the actual data store is decided at the
 * server by `DATABASE_URL` (see `src/lib/supabase/server.ts`).
 */
export type PlatformMode = "local" | "networked";

export const PLATFORM_MODE_COOKIE = "spir_mode";
export const PLATFORM_MODE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
