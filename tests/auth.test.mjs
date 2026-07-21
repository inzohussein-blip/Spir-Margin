// Business logic: built-in auth (migration 0059) — bcrypt via pgcrypto.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

test("seeded admin verifies with the default password and rejects a wrong one", async () => {
  const db = await bootWithMigrations();
  const ok = await db.query(`select id, role from fn_verify_login($1,$2)`, ["admin@spir.local", "admin1234"]);
  assert.equal(ok.rows.length, 1);
  assert.equal(ok.rows[0].role, "admin");

  const bad = await db.query(`select id from fn_verify_login($1,$2)`, ["admin@spir.local", "wrong-password"]);
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
