/**
 * Fixed sign-in credentials for the local platform.
 *
 * The local build (embedded PGlite, no `DATABASE_URL`) does NOT verify the
 * password against a hash stored in the database — it compares it against
 * these constants in code. That way the "shared secret" for the local
 * platform lives with the source, not with the DB file: deleting or
 * copying `./.pglite-data/` does not change what unlocks the app.
 *
 * These constants are ignored on the networked (hosted Supabase) platform,
 * where sign-in continues to go through `fn_verify_login` and bcrypt.
 */
export const LOCAL_ADMIN_EMAIL = "admin@spir.local";
export const LOCAL_ADMIN_PASSWORD = "123";

/**
 * Deterministic user id issued for the local admin's session. It never
 * needs to line up with a row in `app_users` because the local mode
 * short-circuits before the database is consulted.
 */
export const LOCAL_ADMIN_ID = "00000000-0000-0000-0000-000000000001";
