// Shared test helpers: boot an in-memory PGlite with this project's schema.
// Uses the same contrib/role setup that src/lib/db/pglite.ts applies at boot,
// so the tests exercise the real migrations — no mocks.
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
export const SCHEMA_FILE = join(ROOT, "supabase", "schema.sql");

async function prelude(db) {
  await db.exec("create extension if not exists pgcrypto;");
  await db.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
  end $$;`);
}

/** Fresh PGlite with every migration applied, in filename order. */
export async function bootWithMigrations() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await prelude(db);
  for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
  }
  return db;
}

/** Fresh PGlite bootstrapped from the combined single-file schema.sql. */
export async function bootWithSchemaFile() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await prelude(db);
  await db.exec(readFileSync(SCHEMA_FILE, "utf8"));
  return db;
}

/** Ensure at least one lab + one product exist; return their ids. */
export async function ensureLabAndProduct(db) {
  let lab = (await db.query(`select id from labs limit 1`)).rows[0];
  if (!lab) {
    lab = (await db.query(
      `insert into labs (code, name) values ('L-TST','Test Lab') returning id`
    )).rows[0];
  }
  let product = (await db.query(`select id from products where product_type='spare_part' limit 1`)).rows[0];
  if (!product) {
    product = (await db.query(
      `insert into products (item_code, name, product_type) values ('P-TST','Test Part','spare_part') returning id`
    )).rows[0];
  }
  return { labId: lab.id, productId: product.id };
}
