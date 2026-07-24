// Migration 0083: the login throttle lives in the database so a lockout is
// durable and shared across instances. 5 failures within the window locks the
// email for 15 minutes; a success clears it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

const rem = async (db, email) =>
  Number((await db.query(`select fn_login_lockout_remaining($1) as n`, [email])).rows[0].n);
const fail = (db, email) => db.query(`select fn_login_record_failure($1)`, [email]);

test("five failures lock the email; a success clears the counter", async () => {
  const db = await bootWithMigrations();
  const email = "attacker@example.com";

  assert.equal(await rem(db, email), 0, "not locked initially");
  for (let i = 0; i < 4; i++) await fail(db, email);
  assert.equal(await rem(db, email), 0, "four failures do not lock yet");

  await fail(db, email); // fifth
  const left = await rem(db, email);
  assert.ok(left > 0 && left <= 15 * 60, `locked for up to 15 min, got ${left}s`);

  // Case-insensitive on the email.
  assert.ok((await rem(db, "ATTACKER@example.com")) > 0, "lockout keyed case-insensitively");

  // A successful sign-in clears it.
  await db.query(`select fn_login_record_success($1)`, [email]);
  assert.equal(await rem(db, email), 0, "counter cleared after success");
  await db.close();
});

test("failures older than the window do not accumulate into a lock", async () => {
  const db = await bootWithMigrations();
  const email = "slow@example.com";
  // Seed a stale first attempt (16 minutes ago) at 4 fails.
  await db.query(
    `insert into login_attempts (email, fails, first_at) values ($1, 4, now() - interval '16 minutes')`,
    [email],
  );
  // A new failure resets the window rather than tipping into a lock.
  await fail(db, email);
  assert.equal(await rem(db, email), 0, "stale failures rolled off; not locked");
  const row = (await db.query(`select fails from login_attempts where email=$1`, [email])).rows[0];
  assert.equal(row.fails, 1, "counter restarted at 1");
  await db.close();
});
