// Money-critical guarantees behind the POS / sales path. A sales bug here
// misreports revenue or profit, so these pin the invariants the createPosSale
// action and the profit dashboard depend on.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

async function seedLabProduct(db, { buy = 100, sell = 150 } = {}) {
  const lab = (await db.query(`insert into labs (code,name) values ($1,'C') returning id`,
    ["L" + Math.random().toString(36).slice(2, 6)])).rows[0].id;
  const prod = (await db.query(
    `insert into products (item_code,name,product_type,default_buy_price,default_sell_price)
     values ($1,'P','spare_part',$2,$3) returning id`,
    ["P" + Math.random().toString(36).slice(2, 6), buy, sell])).rows[0].id;
  return { lab, prod };
}

test("sales.profit = (sell - buy) * qty", async () => {
  const db = await bootWithMigrations();
  const { lab, prod } = await seedLabProduct(db);
  await db.query(
    `insert into sales (lab_id,product_id,qty,buy_price,sell_price) values ($1,$2,$3,$4,$5)`,
    [lab, prod, 4, 100, 150]);
  const r = await db.query(`select profit from sales order by created_at desc limit 1`);
  assert.equal(Number(r.rows[0].profit), 200); // (150-100)*4
  await db.close();
});

test("v_profit_summary aggregates revenue, cost and profit correctly", async () => {
  const db = await bootWithMigrations();
  const { lab, prod } = await seedLabProduct(db);
  await db.query(`insert into sales (lab_id,product_id,qty,buy_price,sell_price) values
    ($1,$2,2,100,150), ($1,$2,3,100,200)`, [lab, prod]);
  const s = (await db.query(`select total_revenue, total_cost, total_profit, sales_count from v_profit_summary`)).rows[0];
  assert.equal(Number(s.total_revenue), 2 * 150 + 3 * 200); // 900
  assert.equal(Number(s.total_cost), 5 * 100);              // 500
  assert.equal(Number(s.total_profit), 900 - 500);          // 400
  await db.close();
});

test("a sale line with qty <= 0 is rejected", async () => {
  const db = await bootWithMigrations();
  const { lab, prod } = await seedLabProduct(db);
  await assert.rejects(
    db.query(`insert into sales (lab_id,product_id,qty,buy_price,sell_price) values ($1,$2,0,100,150)`, [lab, prod]),
    /check|violates|qty/i);
  await db.close();
});

test("a batch insert is atomic — one bad row books none", async () => {
  const db = await bootWithMigrations();
  const { lab, prod } = await seedLabProduct(db);
  const before = (await db.query(`select count(*)::int n from sales`)).rows[0].n;
  await assert.rejects(db.query(
    `insert into sales (lab_id,product_id,qty,buy_price,sell_price) values
       ($1,$2,1,100,150),
       ($1,'00000000-0000-0000-0000-0000000000ff',1,100,150)`, [lab, prod]));
  const after = (await db.query(`select count(*)::int n from sales`)).rows[0].n;
  assert.equal(after, before, "no rows should have been booked");
  await db.close();
});

test("a sale referencing a non-existent customer or product is rejected", async () => {
  const db = await bootWithMigrations();
  const { prod } = await seedLabProduct(db);
  await assert.rejects(db.query(
    `insert into sales (lab_id,product_id,qty,buy_price,sell_price)
     values ('00000000-0000-0000-0000-0000000000ff',$1,1,100,150)`, [prod]),
    /foreign key|violates/i);
  await db.close();
});
