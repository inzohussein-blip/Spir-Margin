/**
 * The built-in account.
 *
 * Spir-Margin runs for a single company, on machines that may have no hosted
 * database and no internet, so there is one fixed account that lives in the
 * source rather than in a table. It is checked before anything touches the
 * database, which is what makes sign-in work on a fresh install, offline, and
 * while the hosted database is unreachable.
 *
 * Database-backed accounts still work when a database is reachable; this is
 * the account that always works.
 */
export const DEMO_EMAIL = "admin@spir.local";
export const DEMO_PASSWORD = "123";

/** Fixed id so the built-in account owns the same rows across restarts. */
export const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

export const DEMO_FULL_NAME = "المسؤول";
