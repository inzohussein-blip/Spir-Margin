// Verify (and optionally repair) a DATABASE-BACKED login against the hosted
// Postgres referenced by DATABASE_URL.
//
// Note what this cannot tell you: the app's built-in account
// (src/lib/auth/demo-credentials.ts) is checked in code before any database
// call and has no row anywhere, which is what lets it sign in on a machine
// with no database and no internet. Asking this script about it would report
// a failure for an account that works, so it refuses that email instead.
//
// It never prints passwords or password hashes. Run it from CI (see
// .github/workflows/verify-admin.yml) so the connection string stays in a
// GitHub Actions secret and is never exposed in the repository or the chat.
//
// Env:
//   DATABASE_URL         (required) hosted Postgres connection string
//   CHECK_EMAIL          account to check           (required)
//   CHECK_PASSWORD       password to test           (required)
//   RESET                "1" to repair on failure   (default off)
//   ADMIN_NEW_PASSWORD   new password used when RESET=1 (from a secret, never an input)
//
// Exit codes: 0 = login works (or was repaired), 1 = login failed,
//             2 = misconfiguration, 3 = schema/migrations missing.

import fs from "node:fs";
import pg from "pg";

/** Read the built-in address from the source, so the two cannot drift apart. */
function builtInEmail() {
  try {
    const src = fs.readFileSync("src/lib/auth/demo-credentials.ts", "utf8");
    return /DEMO_EMAIL\s*=\s*"([^"]+)"/.exec(src)?.[1] ?? null;
  } catch {
    return null;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set — add it as a GitHub Actions secret.");
  process.exit(2);
}

const email = (process.env.CHECK_EMAIL || "").trim();
const password = process.env.CHECK_PASSWORD ?? "";
if (!email || !password) {
  console.error("Set CHECK_EMAIL and CHECK_PASSWORD (a database-backed account).");
  process.exit(2);
}

const builtIn = builtInEmail();
if (builtIn && email.toLowerCase() === builtIn.toLowerCase()) {
  console.error(
    `${email} is the app's built-in account. It is checked in code, not in the\n` +
      "database, so there is nothing here to verify or repair — and it keeps\n" +
      "working even when this database is unreachable. To change it, edit\n" +
      "src/lib/auth/demo-credentials.ts and redeploy.\n\n" +
      "Pass CHECK_EMAIL for a database-backed account instead.",
  );
  process.exit(2);
}
const doReset = process.env.RESET === "1";
const newPassword = process.env.ADMIN_NEW_PASSWORD || "";

const pool = new pg.Pool({
  connectionString: url,
  ssl: process.env.PGSSL === "disable" ? undefined : { rejectUnauthorized: false },
  max: 2,
});

function ok(v) {
  return Array.isArray(v) && v.length > 0;
}

const client = await pool.connect();
try {
  const { rows: reg } = await client.query("select to_regclass('public.app_users') as t");
  if (!reg[0].t) {
    console.log(
      "❌ Table app_users does not exist on this database.\n" +
        "   The app's migrations have not been applied here. Deploy the app once\n" +
        "   with DATABASE_URL pointing at this database (it auto-applies migrations),\n" +
        "   or apply supabase/migrations manually, then re-run this check."
    );
    process.exit(3);
  }

  const { rows: users } = await client.query(
    "select email, role, is_active, created_at from app_users order by created_at"
  );
  console.log(`Accounts in app_users (${users.length}):`);
  for (const u of users) {
    console.log(`  • ${u.email}   role=${u.role}   active=${u.is_active}`);
  }
  console.log("");

  const { rows: v } = await client.query(
    "select id, email, role from fn_verify_login($1, $2)",
    [email, password]
  );
  const passed = ok(v);
  console.log(`Login check for ${email}: ${passed ? "SUCCESS ✅" : "FAILED ❌"}`);

  if (passed) {
    console.log(`  role = ${v[0].role}`);
    process.exit(0);
  }

  if (!doReset) {
    console.log(
      "\nThe tested password did not match. Re-run with RESET=1 and an\n" +
        "ADMIN_NEW_PASSWORD secret to set a known password for this account."
    );
    process.exit(1);
  }

  if (!newPassword) {
    console.error(
      "\nRESET=1 but ADMIN_NEW_PASSWORD is empty — add it as a repository secret first."
    );
    process.exit(2);
  }

  const { rows: found } = await client.query(
    "select id from app_users where lower(email) = lower($1)",
    [email]
  );
  if (found.length) {
    await client.query("select fn_set_password($1, $2)", [found[0].id, newPassword]);
    console.log(`\nPassword for ${email} has been reset.`);
  } else {
    await client.query(
      "select fn_create_user($1, $2, $3, $4::app_user_role)",
      [email, newPassword, "Administrator", "admin"]
    );
    console.log(`\n${email} did not exist and was created as an admin.`);
  }

  const { rows: v2 } = await client.query(
    "select id from fn_verify_login($1, $2)",
    [email, newPassword]
  );
  const repaired = ok(v2);
  console.log(`Post-repair login check: ${repaired ? "SUCCESS ✅" : "FAILED ❌"}`);
  process.exit(repaired ? 0 : 1);
} finally {
  client.release();
  await pool.end();
}
