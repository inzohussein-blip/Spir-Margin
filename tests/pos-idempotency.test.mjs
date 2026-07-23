// Business logic: idempotent POS checkout (migration 0073) — offline replays
// must never double-post a sale.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

const lines = (productId) => JSON.stringify([{ product_id: productId, qty: 2, sell_price: 50 }]);

test("a checkout books the sale once and reports the right total", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);
  const req = randomUUID();

  const res = await db.query(`select n_lines, total_amount from fn_pos_checkout($1,$2,$3)`, [req, labId, lines(productId)]);
  assert.equal(Number(res.rows[0].n_lines), 1);
  assert.equal(Number(res.rows[0].total_amount), 100);

  const count = await db.query(`select count(*)::int as n from sales where lab_id=$1`, [labId]);
  assert.equal(count.rows[0].n, 1);
  await db.close();
});

test("replaying the same request id changes nothing and returns the stored result", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);
  const req = randomUUID();

  const first = await db.query(`select n_lines, total_amount from fn_pos_checkout($1,$2,$3)`, [req, labId, lines(productId)]);
  // Replay the exact same request several times (simulating a lost response + retries).
  for (let i = 0; i < 3; i++) {
    const again = await db.query(`select n_lines, total_amount from fn_pos_checkout($1,$2,$3)`, [req, labId, lines(productId)]);
    assert.equal(Number(again.rows[0].n_lines), Number(first.rows[0].n_lines));
    assert.equal(Number(again.rows[0].total_amount), Number(first.rows[0].total_amount));
  }

  // Exactly one sale exists — no duplicates from the replays.
  const count = await db.query(`select count(*)::int as n from sales where lab_id=$1`, [labId]);
  assert.equal(count.rows[0].n, 1);
  await db.close();
});

test("a different request id books a separate sale; bad input is rejected", async () => {
  const db = await bootWithMigrations();
  const { labId, productId } = await ensureLabAndProduct(db);

  await db.query(`select fn_pos_checkout($1,$2,$3)`, [randomUUID(), labId, lines(productId)]);
  await db.query(`select fn_pos_checkout($1,$2,$3)`, [randomUUID(), labId, lines(productId)]);
  const count = await db.query(`select count(*)::int as n from sales where lab_id=$1`, [labId]);
  assert.equal(count.rows[0].n, 2);

  // Negative sell price is rejected (money integrity).
  await assert.rejects(
    () => db.query(`select fn_pos_checkout($1,$2,$3)`, [randomUUID(), labId, JSON.stringify([{ product_id: productId, qty: 1, sell_price: -5 }])]),
    /negative/i,
  );
  // Unknown customer is rejected.
  await assert.rejects(
    () => db.query(`select fn_pos_checkout($1,$2,$3)`, [randomUUID(), "00000000-0000-0000-0000-0000000000ff", lines(productId)]),
    /customer/i,
  );
  await db.close();
});
