// Immutable audit trail (migration 0065). Compliance-critical: the log must
// capture every change and must be impossible to rewrite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

async function seed(db) {
  const lab = (await db.query(`insert into labs (code,name) values ('L-AU','Lab') returning id`)).rows[0].id;
  const prod = (await db.query(
    `insert into products (item_code,name,product_type,default_buy_price,default_sell_price)
     values ('P-AU','P','spare_part',100,150) returning id`)).rows[0].id;
  return { lab, prod };
}

test("insert/update/delete on an audited table are all captured", async () => {
  const db = await bootWithMigrations();
  const { lab, prod } = await seed(db);
  const sale = (await db.query(
    `insert into sales (lab_id,product_id,qty,buy_price,sell_price) values ($1,$2,1,100,150) returning id`,
    [lab, prod])).rows[0].id;
  await db.query(`update sales set sell_price=200 where id=$1`, [sale]);
  await db.query(`delete from sales where id=$1`, [sale]);
  const rows = (await db.query(
    `select action, changed_fields from audit_log where table_name='sales' and record_id=$1 order by id`, [sale])).rows;
  assert.deepEqual(rows.map((r) => r.action), ["INSERT", "UPDATE", "DELETE"]);
  await db.close();
});

test("UPDATE records only the fields that actually changed", async () => {
  const db = await bootWithMigrations();
  const { prod } = await seed(db);
  await db.query(`update products set default_sell_price=175 where id=$1`, [prod]);
  const r = (await db.query(
    `select changed_fields from audit_log where table_name='products' and action='UPDATE' order by id desc limit 1`)).rows[0];
  assert.deepEqual(r.changed_fields, ["default_sell_price"]);
  await db.close();
});

test("the actor is captured from the app.actor setting", async () => {
  const db = await bootWithMigrations();
  const { lab, prod } = await seed(db);
  await db.query(`select set_config('app.actor','engineer@spir.local',false)`);
  await db.query(`insert into sales (lab_id,product_id,qty,buy_price,sell_price) values ($1,$2,1,100,150)`, [lab, prod]);
  const r = (await db.query(`select actor from audit_log where table_name='sales' order by id desc limit 1`)).rows[0];
  assert.equal(r.actor, "engineer@spir.local");
  await db.close();
});

test("the audit log is append-only — updates and deletes are rejected", async () => {
  const db = await bootWithMigrations();
  const { lab, prod } = await seed(db);
  await db.query(`insert into sales (lab_id,product_id,qty,buy_price,sell_price) values ($1,$2,1,100,150)`, [lab, prod]);
  await assert.rejects(db.query(`update audit_log set actor='forged' where id=1`), /append-only/i);
  await assert.rejects(db.query(`delete from audit_log where id=1`), /append-only/i);
  await db.close();
});
