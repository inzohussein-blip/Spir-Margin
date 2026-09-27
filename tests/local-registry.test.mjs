// The web app's registry (src/lib/local/registry.ts) against the real schema:
// every list, record and line query runs; every field, reference, choice and
// button names something that exists; and the documents' buttons do what the
// installed version's do — on an embedded Postgres with every migration,
// through the same query builder the browser uses.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations, importTs } from "./helpers.mjs";

const core = await importTs("src/lib/db/rest-core.ts");
const { ENTITIES, stationPages } = await importTs("src/lib/local/registry.ts");
let db, meta, c;
before(async () => {
  db = await bootWithMigrations();
  meta = await core.introspect(db);
  c = new core.PgRestClient({ open: async () => ({ db, meta }), error: core.plainDbError });
});
after(async () => { await db.close(); });

const cols = (t) => meta.columns[t] ?? new Set();
async function enumOf(table, column) {
  const r = await db.query(
    `select e.enumlabel as v from information_schema.columns c join pg_type t on t.typname = c.udt_name join pg_enum e on e.enumtypid = t.oid
      where c.table_schema = 'public' and c.table_name = $1 and c.column_name = $2`, [table, column]);
  return r.rows.map((x) => x.v);
}
async function checksOf(table) {
  const r = await db.query(`select pg_get_constraintdef(oid) as d from pg_constraint where contype = 'c' and conrelid = $1::regclass`, [table]);
  return r.rows.map((x) => x.d).join(" ");
}
/** A function's arguments: [name, has a default]. */
async function fnArgs(name) {
  const r = await db.query(`select pg_get_function_arguments(oid) as a from pg_proc where proname = $1 and pronamespace = 'public'::regnamespace`, [name]);
  if (!r.rows.length) return null;
  return r.rows[0].a.split(/,\s*(?=p_)/).map((x) => [x.trim().split(/\s+/)[0], /\bDEFAULT\b/.test(x)]);
}
const recordSelect = (e) => ["*", ...e.fields.filter((f) => f.type === "ref" && !f.ref.value).map((f) => `r_${f.name}:${f.name}(${[f.ref.label, f.ref.code].filter(Boolean).join(", ")})`)].join(", ");

test("every page is unique, belongs to a station, and every station has pages", () => {
  const ids = ENTITIES.map((e) => e.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const s of ["sales", "supply", "service", "manufacturing", "accounts", "hr", "coldchain", "guides"]) {
    assert.ok(stationPages(s).length > 0, `station ${s} has no pages`);
  }
});

test("every list, record and line query runs on the real schema", async () => {
  for (const e of ENTITIES) {
    assert.ok(meta.tables.has(e.table), `${e.id}: no table ${e.table}`);
    let q = c.from(e.table).select(e.select, { count: "exact" }).search(e.search, "x");
    for (const [col, op, val] of e.where ?? []) q = op === "in" ? q.in(col, val) : op === "gt" ? q.gt(col, val) : op === "neq" ? q.neq(col, val) : q.eq(col, val);
    const list = await q.order(e.order[0], { ascending: e.order[1] }).range(0, 49);
    assert.equal(list.error, null, `${e.id} list: ${list.error?.message}`);
    for (const col of e.columns) {
      const [head] = col.key.split(".");
      assert.ok(col.key.includes(".") || cols(e.table).has(head), `${e.id}: column ${col.key}`);
      if (col.key.includes(".")) assert.match(e.select, new RegExp(`\\b${head}[:(]`), `${e.id}: ${col.key} is not embedded`);
    }
    if (e.readonly) continue;
    const rec = await c.from(e.table).select(recordSelect(e)).limit(1);
    assert.equal(rec.error, null, `${e.id} record: ${rec.error?.message}`);
    assert.ok(cols(e.table).has(e.title), `${e.id}: title ${e.title}`);
    if (e.lines) {
      assert.ok(cols(e.lines.table).has(e.lines.fk), `${e.id}: lines fk`);
      const l = await c.from(e.lines.table).select(e.lines.select).limit(1);
      assert.equal(l.error, null, `${e.id} lines: ${l.error?.message}`);
    }
  }
});

test("every field, reference and choice names something that exists", async () => {
  for (const e of ENTITIES) {
    const groups = [[e.table, e.fields], ...(e.lines ? [[e.lines.table, e.lines.fields]] : [])];
    for (const [table, fields] of groups) {
      const checks = await checksOf(table);
      for (const f of fields) {
        assert.ok(cols(table).has(f.name), `${e.id}: ${table}.${f.name}`);
        if (f.ref) {
          const r = f.ref;
          assert.ok(meta.tables.has(r.table), `${e.id}.${f.name}: ref table ${r.table}`);
          for (const k of [r.label, r.code, r.value, ...Object.values(r.fill ?? {}), ...Object.keys(r.where ?? {})].filter(Boolean)) {
            assert.ok(cols(r.table).has(k), `${e.id}.${f.name}: ${r.table}.${k}`);
          }
          for (const k of Object.keys(r.fill ?? {})) assert.ok(fields.some((x) => x.name === k), `${e.id}.${f.name}: fills unknown field ${k}`);
        }
        if (f.options) {
          const values = await enumOf(table, f.name);
          // An enum must hold every choice; a text column limited by a check must allow it.
          if (values.length) for (const o of f.options) assert.ok(values.includes(o), `${e.id}.${f.name}: ${o} not in enum`);
          else if (checks.includes(`${f.name} = ANY`)) for (const o of f.options) assert.ok(checks.includes(`'${o}'`), `${e.id}.${f.name}: ${o} not allowed`);
        }
      }
    }
  }
});

test("every button calls a function that exists, with the arguments it takes, in statuses that exist", async () => {
  for (const e of ENTITIES) {
    const statuses = cols(e.table).has("status") ? await enumOf(e.table, "status") : [];
    for (const list of [e.editable, e.deletable]) for (const s of list ?? []) assert.ok(statuses.includes(s), `${e.id}: status ${s}`);
    for (const a of e.actions ?? []) {
      for (const s of a.when ?? []) assert.ok(statuses.includes(s), `${e.id}.${a.id}: status ${s}`);
      if (a.rpc) {
        const args = await fnArgs(a.rpc);
        assert.ok(args, `${e.id}.${a.id}: no function ${a.rpc}`);
        const given = [a.arg, ...Object.keys(a.args ?? {}), a.input?.name, a.numbered?.name].filter(Boolean);
        for (const name of given) assert.ok(args.some(([n]) => n === name), `${e.id}.${a.id}: ${a.rpc} takes no ${name}`);
        for (const [n, optional] of args) assert.ok(optional || given.includes(n), `${e.id}.${a.id}: ${a.rpc} needs ${n}`);
      }
      for (const [k, v] of Object.entries(a.update ?? {})) {
        assert.ok(cols(e.table).has(k), `${e.id}.${a.id}: ${k}`);
        if (k === "status") assert.ok(statuses.includes(v), `${e.id}.${a.id}: status ${v}`);
      }
      if (a.opens) assert.ok(ENTITIES.some((x) => x.id === a.opens), `${e.id}.${a.id}: opens ${a.opens}`);
      if (a.input?.from) assert.ok(cols(e.table).has(a.input.from), `${e.id}.${a.id}: ${a.input.from}`);
    }
    if (e.opens) assert.ok(ENTITIES.some((x) => x.id === e.opens), `${e.id}: opens ${e.opens}`);
  }
});

// ---------------------------------------------------------------- flows
const rpc = async (fn, args) => { const r = await c.rpc(fn, args); assert.equal(r.error, null, `${fn}: ${r.error?.message}`); return r.data; };
const one = async (q) => { const r = await q; assert.equal(r.error, null, r.error?.message); return r.data; };

test("the sales documents' buttons: quotation → sales order → deliver → invoice → pay", async () => {
  const lab = await one(c.from("labs").insert({ code: "R-1", name: "مختبر السجل" }).select("id").single());
  const prod = await one(c.from("products").insert({ item_code: "R-P", name: "صنف", product_type: "spare_part", default_sell_price: 10 }).select("id").single());
  const qt = await one(c.from("quotations").insert({ naming_series: "QT-1", lab_id: lab.id }).select("id").single());
  await one(c.from("quotation_items").insert({ quotation_id: qt.id, product_id: prod.id, qty: 2, rate: 10 }));
  await one(c.from("quotations").update({ status: "submitted" }).eq("id", qt.id));
  const so = await rpc("fn_quotation_to_sales_order", { p_quote_id: qt.id });
  const soId = typeof so === "string" ? so : Array.isArray(so) ? so[0]?.id : so?.id;
  assert.ok(soId, `the sales order id comes back: ${JSON.stringify(so)}`);
  await rpc("fn_deliver_sales_order", { p_so_id: soId });
  const inv = await rpc("fn_invoice_from_sales_order", { p_so_id: soId, p_invoice_no: "SI-R-1" });
  const invId = typeof inv === "string" ? inv : Array.isArray(inv) ? inv[0]?.id : inv?.id;
  assert.ok(invId, `the invoice id comes back: ${JSON.stringify(inv)}`);
  const i1 = await one(c.from("sales_invoices").select("status, total_amount, outstanding").eq("id", invId).single());
  if (i1.status === "draft") await rpc("fn_submit_sales_invoice", { p_invoice_id: invId });
  await rpc("fn_record_invoice_payment", { p_invoice_id: invId, p_amount: 20 });
  const i2 = await one(c.from("sales_invoices").select("status, outstanding").eq("id", invId).single());
  assert.equal(i2.status, "paid");
});

test("a document numbered by fn_next_doc_no, and the buying buttons: purchase order, receipt into stock", async () => {
  const no = await rpc("fn_next_doc_no", { p_kind: "po" });
  const poNo = typeof no === "string" ? no : Object.values(Array.isArray(no) ? no[0] : no)[0];
  assert.match(String(poNo), /PO-\d{4}-\d{4}$/);
  const sup = await one(c.from("companies").insert({ name: "مورد" }).select("id").single());
  const prod = await one(c.from("products").insert({ item_code: "R-K", name: "عدّة", product_type: "kit", default_buy_price: 4 }).select("id").single());
  const po = await one(c.from("purchase_orders").insert({ po_no: poNo, supplier_id: sup.id }).select("id").single());
  await one(c.from("purchase_order_items").insert({ po_id: po.id, product_id: prod.id, qty: 5, rate: 4 }));
  await rpc("fn_submit_purchase_order", { p_po_id: po.id });
  const wh = await one(c.from("warehouses").insert({ name: "المخزن" }).select("id").single());
  const pr = await one(c.from("purchase_receipts").insert({ receipt_no: "PR-1", supplier_id: sup.id }).select("id").single());
  await one(c.from("purchase_receipt_items").insert({ receipt_id: pr.id, product_id: prod.id, qty: 5, rate: 4, warehouse_id: wh.id, batch_no: "B-1", expiry_date: "2030-01-01" }));
  await rpc("fn_submit_purchase_receipt", { p_receipt_id: pr.id });
  const bal = await one(c.from("v_stock_balance").select("qty").eq("product_id", prod.id));
  assert.equal(bal.reduce((s, r) => s + Number(r.qty), 0), 5);
});

test("every column the database requires is in the form (or the line's link to its document)", async () => {
  const need = async (t) => (await db.query(
    `select column_name as c from information_schema.columns where table_schema = 'public' and table_name = $1 and is_nullable = 'NO' and column_default is null`, [t])).rows.map((r) => r.c);
  for (const e of ENTITIES.filter((x) => !x.readonly)) {
    for (const c of await need(e.table)) assert.ok(e.fields.some((f) => f.name === c), `${e.id}: ${e.table}.${c} is required but not in the form`);
    if (e.lines) for (const c of await need(e.lines.table)) assert.ok(c === e.lines.fk || e.lines.fields.some((f) => f.name === c), `${e.id}: ${e.lines.table}.${c} is required but not in the lines`);
  }
});
