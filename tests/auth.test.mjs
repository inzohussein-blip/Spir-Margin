// Business logic: built-in auth (migration 0059) — bcrypt via pgcrypto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

test("no database account ships with a published password", async () => {
  // Migration 0107: admin@spir.local / admin1234 and demo@spir.local /
  // demo1234 used to exist in every database, both administrators.
  const db = await bootWithMigrations();
  for (const [email, pw] of [["admin@spir.local", "admin1234"], ["demo@spir.local", "demo1234"]]) {
    const r = await db.query(`select id from fn_verify_login($1,$2)`, [email, pw]);
    assert.equal(r.rows.length, 0, `${email} should not sign in with ${pw}`);
  }
  const left = await db.query(`select count(*)::int as n from app_users`);
  assert.equal(left.rows[0].n, 0, "a new database has no accounts; the built-in one lives in code");
  await db.close();
});

test("a created admin verifies with its password and rejects a wrong one", async () => {
  const db = await bootWithMigrations();
  await db.query(`select fn_create_user($1,$2,$3,$4)`, ["boss@spir.test", "right-pass", "Boss", "admin"]);
  const ok = await db.query(`select id, role from fn_verify_login($1,$2)`, ["boss@spir.test", "right-pass"]);
  assert.equal(ok.rows.length, 1);
  assert.equal(ok.rows[0].role, "admin");
  const bad = await db.query(`select id from fn_verify_login($1,$2)`, ["boss@spir.test", "wrong-password"]);
  assert.equal(bad.rows.length, 0);
  await db.close();
});

test("a created user can log in and a changed password takes effect", async () => {
  const db = await bootWithMigrations();
  const created = await db.query(
    `select fn_create_user($1,$2,$3,$4) as id`,
    ["tester@spir.local", "initial-pass", "Tester", "staff"]
  );
  const id = created.rows[0].id;
  assert.ok(id);

  const login1 = await db.query(`select id from fn_verify_login($1,$2)`, ["tester@spir.local", "initial-pass"]);
  assert.equal(login1.rows.length, 1);

  await db.query(`select fn_set_password($1,$2)`, [id, "new-pass-123"]);
  const oldFails = await db.query(`select id from fn_verify_login($1,$2)`, ["tester@spir.local", "initial-pass"]);
  assert.equal(oldFails.rows.length, 0);
  const newWorks = await db.query(`select id from fn_verify_login($1,$2)`, ["tester@spir.local", "new-pass-123"]);
  assert.equal(newWorks.rows.length, 1);
  await db.close();
});
