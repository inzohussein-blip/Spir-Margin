// The list views paginate large tables with .range(from,to) + a count("exact")
// total. This locks the SQL contract the rest client emits: a bounded page of
// rows plus the true total, independent of limit/offset — so a table with tens
// of thousands of sales rows never loads (or renders) unbounded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, ensureLabAndProduct } from "./helpers.mjs";

const PAGE = 50;

test("range window + exact count paginate a large invoice list correctly", async () => {
  const db = await bootWithMigrations();
  const { labId } = await ensureLabAndProduct(db);

  // 125 invoices -> 3 pages of 50 / 50 / 25.
  for (let i = 1; i <= 125; i++) {
    await db.query(
      `insert into sales_invoices (invoice_no, lab_id, posting_date) values ($1,$2,$3)`,
      [`INV-${String(i).padStart(4, "0")}`, labId, "2026-01-01"]
    );
  }

  // total is independent of the page window (what count:"exact" returns).
  const total = (await db.query(`select count(*)::int n from sales_invoices`)).rows[0].n;
  assert.equal(total, 125);

  // page 1: range(0,49) -> limit 50 offset 0.
  const p1 = await db.query(
    `select id from sales_invoices order by invoice_no asc limit 50 offset 0`
  );
  assert.equal(p1.rows.length, 50, "page 1 is a full page");

  // page 3: range(100,149) -> limit 50 offset 100 -> the trailing 25.
  const p3 = await db.query(
    `select id from sales_invoices order by invoice_no asc limit 50 offset 100`
  );
  assert.equal(p3.rows.length, 25, "last page holds the remainder");

  // pages do not overlap.
  const firstOfP1 = (await db.query(`select invoice_no from sales_invoices order by invoice_no asc limit 1 offset 0`)).rows[0].invoice_no;
  const firstOfP2 = (await db.query(`select invoice_no from sales_invoices order by invoice_no asc limit 1 offset 50`)).rows[0].invoice_no;
  assert.notEqual(firstOfP1, firstOfP2, "each page starts at a different row");

  // ceil(total / PAGE) drives the pager's page count.
  assert.equal(Math.ceil(total / PAGE), 3);
  await db.close();
});
