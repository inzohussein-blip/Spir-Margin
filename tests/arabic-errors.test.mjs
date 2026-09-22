// Every error the database raises is Arabic (migration 0102).
//
// Many actions show error.message to the user as it is, so an English
// `raise exception` in any function reaches the screen word for word. This
// asks the live database — not the migration files — so a later migration
// that adds or restores an English message fails here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { bootWithMigrations } from "./helpers.mjs";

test("no database function raises an English error", async () => {
  const db = await bootWithMigrations();
  const rows = (await db.query(`
    select p.proname, m[1] as msg
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace,
           regexp_matches(p.prosrc, 'raise\\s+exception\\s+''([^'']*)''', 'gi') as m
     where n.nspname = 'public'`)).rows;
  assert.ok(rows.length > 50, `expected the app's error messages, found ${rows.length}`);
  const english = rows.filter((r) => /[A-Za-z]{3,}/.test(r.msg) && !/[؀-ۿ]/.test(r.msg));
  assert.deepEqual(english.map((r) => `${r.proname}: ${r.msg}`), []);
  await db.close();
});

test("a translated error still carries its numbers", async () => {
  const db = await bootWithMigrations();
  const prod = (await db.query(
    `insert into products (item_code,name,product_type,default_buy_price,default_sell_price)
     values ('K-AR','كِت','kit',10,20) returning id`)).rows[0].id;
  await assert.rejects(
    () => db.query(`select fn_consume_product_stock($1, 3)`, [prod]),
    (e) => /الكمية غير كافية من كِت: المتوفّر 0 والمطلوب 3/.test(e.message),
  );
  await db.close();
});
