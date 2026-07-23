// Monitoring surfaces (migration 0074) + reuse of the audit trail for the
// "what was deleted or changed" view.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

test("app_errors enforces valid severity and source", async () => {
  const db = await bootWithMigrations();
  await db.query(`insert into app_errors (message, severity, source) values ('boom','error','client')`);
  await db.query(`insert into app_errors (message, severity, source) values ('warn','warning','server')`);
  const n = await db.query(`select count(*)::int as n from app_errors`);
  assert.equal(n.rows[0].n, 2);

  await assert.rejects(
    () => db.query(`insert into app_errors (message, severity) values ('x','fatal')`),
    /check|constraint/i,
  );
  await assert.rejects(
    () => db.query(`insert into app_errors (message, source) values ('x','carrier-pigeon')`),
    /check|constraint/i,
  );
  await db.close();
});

test("deleting an audited record is captured in the change/deletion log", async () => {
  const db = await bootWithMigrations();
  const ins = await db.query(
    `insert into products (item_code, name, product_type) values ('DEL-1','To Delete','spare_part') returning id`,
  );
  const id = ins.rows[0].id;

  // An update is recorded as a change...
  await db.query(`update products set name='Renamed' where id=$1`, [id]);
  // ...and a delete as a deletion.
  await db.query(`delete from products where id=$1`, [id]);

  const del = await db.query(
    `select count(*)::int as n from audit_log where table_name='products' and action='DELETE' and record_id=$1`, [id],
  );
  const upd = await db.query(
    `select count(*)::int as n from audit_log where table_name='products' and action='UPDATE' and record_id=$1`, [id],
  );
  assert.equal(del.rows[0].n, 1, "deletion should be recorded");
  assert.equal(upd.rows[0].n, 1, "change should be recorded");
  await db.close();
});

test("connectivity and sync events can be recorded", async () => {
  const db = await bootWithMigrations();
  await db.query(
    `insert into connectivity_events (went_offline_at, came_online_at, duration_seconds) values (now() - interval '2 minutes', now(), 120)`,
  );
  await db.query(`insert into sync_events (item_count, ok, detail) values (3, true, 'synced 3/3')`);
  const c = await db.query(`select duration_seconds from connectivity_events limit 1`);
  const s = await db.query(`select item_count, ok from sync_events limit 1`);
  assert.equal(Number(c.rows[0].duration_seconds), 120);
  assert.equal(Number(s.rows[0].item_count), 3);
  assert.equal(s.rows[0].ok, true);
  await db.close();
});
