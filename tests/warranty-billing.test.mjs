// Warranty billing party (migration 0069): who pays each claim, so warranty
// cost and third-party receivables are visible.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

test("claims default to the agent (covered under warranty)", async () => {
  const db = await bootWithMigrations();
  await db.query(`insert into warranty_claims (complaint) values ('X')`);
  const r = (await db.query(`select billed_to, charge_amount from warranty_claims limit 1`)).rows[0];
  assert.equal(r.billed_to, "agent");
  assert.equal(Number(r.charge_amount), 0);
  await db.close();
});

test("v_warranty_billing totals charges by paying party and excludes cancelled", async () => {
  const db = await bootWithMigrations();
  await db.query(`insert into warranty_claims (billed_to, charge_amount, status) values
    ('agent', 100, 'open'),
    ('hospital', 250, 'work_in_progress'),
    ('hospital', 150, 'closed'),
    ('insurance', 500, 'open'),
    ('hospital', 999, 'cancelled')`);
  const rows = (await db.query(`select billed_to, claims, total_charge from v_warranty_billing order by billed_to`)).rows;
  const by = Object.fromEntries(rows.map((r) => [r.billed_to, Number(r.total_charge)]));
  assert.equal(by.agent, 100);
  assert.equal(by.hospital, 400);      // 250 + 150, cancelled 999 excluded
  assert.equal(by.insurance, 500);
  await db.close();
});
