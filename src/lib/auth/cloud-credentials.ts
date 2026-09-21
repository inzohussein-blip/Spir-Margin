/**
 * Fixed admin credentials for the FULL (cloud) build.
 *
 * The full build is the production, admin-only edition. Only the person
 * holding this credential can sign in — there is no self-registration and,
 * for now, no other DB-backed accounts have to exist. The credential lives
 * in the source (not in the database) exactly like the local trial's does,
 * so it survives DB resets and cannot be phished out of a leaked table.
 *
 * If you ever want to rotate it, change the constant here and redeploy —
 * every previously-issued session cookie remains valid until it expires
 * (JWTs are signed with a separate secret; the password does not sign
 * anything), so the rotation only affects new sign-ins.
 */
export const CLOUD_ADMIN_EMAIL = "admin@spir.cloud";

/**
 * Full-build admin password. Fixed, admin-only. Not shown in the UI.
 *
 *     Email:    admin@spir.cloud
 *     Password: SpirMargin@2026#Admin
 */
export const CLOUD_ADMIN_PASSWORD = "SpirMargin@2026#Admin";

/** Stable UUID for the cloud admin's JWT `sub`; never matches an app_users row. */
export const CLOUD_ADMIN_ID = "00000000-0000-0000-0000-000000000002";
