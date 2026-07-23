// Business logic: feature settings & per-account access (migration 0072).
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

test("feature_flags only accepts the three valid states", async () => {
  const db = await bootWithMigrations();
  await db.query(`insert into feature_flags (feature, state) values ('Stock','disabled')`);
  await db.query(`insert into feature_flags (feature, state) values ('Buying','hidden')`);
  const rows = await db.query(`select feature, state from feature_flags order by feature`);
  assert.deepEqual(rows.rows.map((r) => `${r.feature}:${r.state}`), ["Buying:hidden", "Stock:disabled"]);

  await assert.rejects(
    () => db.query(`insert into feature_flags (feature, state) values ('Selling','bogus')`),
    /check|constraint/i,
  );
  await db.close();
});

test("denying a feature is a per-user row, removed when the account is deleted", async () => {
  const db = await bootWithMigrations();
  const u = await db.query(
    `select fn_create_user($1,$2,$3,$4) as id`,
    ["deny-me@spir.local", "initial-pass", "Deny Me", "staff"],
  );
  const uid = u.rows[0].id;

  await db.query(`insert into user_feature_access (user_id, feature) values ($1,'Stock')`, [uid]);
  await db.query(`insert into user_feature_access (user_id, feature) values ($1,'Buying')`, [uid]);
  const denied = await db.query(`select feature from user_feature_access where user_id=$1 order by feature`, [uid]);
  assert.deepEqual(denied.rows.map((r) => r.feature), ["Buying", "Stock"]);

  // Re-allowing is just a delete.
  await db.query(`delete from user_feature_access where user_id=$1 and feature='Buying'`, [uid]);
  const after = await db.query(`select feature from user_feature_access where user_id=$1`, [uid]);
  assert.deepEqual(after.rows.map((r) => r.feature), ["Stock"]);

  // Deleting the account cascades the deny rows away (no orphans).
  await db.query(`delete from app_users where id=$1`, [uid]);
  const orphans = await db.query(`select count(*)::int as n from user_feature_access where user_id=$1`, [uid]);
  assert.equal(orphans.rows[0].n, 0);
  await db.close();
});
