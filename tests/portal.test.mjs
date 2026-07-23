// Customer portal auth (migration 0070): a portal user is bound to exactly one
// lab, and that binding is what the app scopes every portal query to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

test("a portal user is created with the customer role bound to a lab", async () => {
  const db = await bootWithMigrations();
  const lab = (await db.query(`insert into labs (code,name) values ('LP','Lab P') returning id`)).rows[0].id;
  await db.query(`select fn_create_portal_user('h@x.com','pw12345678','Hosp',$1)`, [lab]);
  const row = (await db.query(`select role, email, lab_id from fn_verify_login('h@x.com','pw12345678')`)).rows[0];
  assert.equal(row.role, "customer");
  assert.equal(row.lab_id, lab);
  await db.close();
});

test("fn_verify_login exposes lab_id for staff too (null) without breaking", async () => {
  const db = await bootWithMigrations();
  const row = (await db.query(`select role, lab_id from fn_verify_login('admin@spir.local','admin1234')`)).rows[0];
  assert.equal(row.role, "admin");
  assert.equal(row.lab_id, null);
  await db.close();
});

test("a wrong password never returns a portal session", async () => {
  const db = await bootWithMigrations();
  const lab = (await db.query(`insert into labs (code,name) values ('LP2','Lab P2') returning id`)).rows[0].id;
  await db.query(`select fn_create_portal_user('h2@x.com','rightpass1','Hosp',$1)`, [lab]);
  const rows = (await db.query(`select id from fn_verify_login('h2@x.com','wrongpass')`)).rows;
  assert.equal(rows.length, 0);
  await db.close();
});
