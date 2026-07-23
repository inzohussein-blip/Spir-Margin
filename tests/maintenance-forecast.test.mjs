// Predictive maintenance forecast (migration 0067): urgency bucketing must be
// correct so nothing overdue slips through.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

async function device(db, daysFromNow) {
  const lab = (await db.query(`insert into labs (code,name) values ($1,'L') returning id`, ["L" + Math.random().toString(36).slice(2, 6)])).rows[0].id;
  const prod = (await db.query(`insert into products (item_code,name,product_type) values ($1,'P','device') returning id`, ["P" + Math.random().toString(36).slice(2, 6)])).rows[0].id;
  await db.query(
    `insert into devices (asset_code, product_id, lab_id, maintenance_required, next_maintenance_date)
     values ($1,$2,$3,true, current_date + ($4)::int)`,
    ["A" + Math.random().toString(36).slice(2, 6), prod, lab, daysFromNow]);
}

test("devices are bucketed by how soon maintenance is due", async () => {
  const db = await bootWithMigrations();
  await device(db, -5);  // overdue
  await device(db, 3);   // this week
  await device(db, 20);  // this month
  await device(db, 60);  // upcoming
  await device(db, 120); // beyond horizon -> excluded
  const rows = (await db.query(`select urgency from v_maintenance_forecast order by next_maintenance_date`)).rows;
  assert.deepEqual(rows.map((r) => r.urgency), ["overdue", "due_this_week", "due_this_month", "upcoming"]);
  await db.close();
});

test("devices that don't need maintenance are excluded", async () => {
  const db = await bootWithMigrations();
  const lab = (await db.query(`insert into labs (code,name) values ('LX','L') returning id`)).rows[0].id;
  const prod = (await db.query(`insert into products (item_code,name,product_type) values ('PX','P','device') returning id`)).rows[0].id;
  await db.query(
    `insert into devices (asset_code, product_id, lab_id, maintenance_required, next_maintenance_date)
     values ('AX',$1,$2,false, current_date + 5)`, [prod, lab]);
  assert.equal((await db.query(`select 1 from v_maintenance_forecast`)).rows.length, 0);
  await db.close();
});
