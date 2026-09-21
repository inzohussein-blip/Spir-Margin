#!/usr/bin/env node
/**
 * Regenerates `supabase/schema.sql` from `supabase/migrations/`.
 *
 * schema.sql is the documented way to stand up a hosted database
 * (`psql "$DATABASE_URL" -f supabase/schema.sql`, see docs/DEPLOYMENT.md), so
 * it has to stay in step with the migrations. It had silently drifted four
 * migrations behind because it was maintained by hand; this makes it a build
 * artifact instead, and `tests/schema.test.mjs` fails if it is stale.
 *
 * The demo seed is deliberately NOT folded in. It is optional, it does not
 * belong in a production database, and `supabase/seed.sql` calls
 * `fn_create_portal_user`, which writes the `customer` enum label that
 * migration 0070 adds — Postgres refuses a new enum value in the transaction
 * that created it, so the combined file could not apply in one go. Load it
 * separately when demo data is wanted:
 *     psql "$DATABASE_URL" -f supabase/seed.sql
 *
 * Run after adding a migration:   npm run schema
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
const OUT = path.join(ROOT, "supabase", "schema.sql");

const files = fs.readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();

const parts = [
  `-- Spir-Margin — combined schema (all ${files.length} migrations). Run ONCE on an EMPTY DB.`,
  `--`,
  `-- GENERATED FILE — do not edit by hand. Rebuild with:`,
  `--     npm run schema`,
  `--`,
  `-- Schema only: no demo data. For a demo database, follow this with`,
  `--     psql "$DATABASE_URL" -f supabase/seed.sql`,
  `--`,
  `-- The full platform signs in with the fixed admin in`,
  `-- src/lib/auth/cloud-credentials.ts; the app_users rows the migrations`,
  `-- create exist for the hybrid build's database-backed accounts.`,
  `create extension if not exists pgcrypto;`,
  `do $$ begin if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; end $$;`,
  `do $$ begin if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if; end $$;`,
  ``,
];

for (const f of files) {
  parts.push(`-- ===== migration: ${f} =====`);
  parts.push(fs.readFileSync(path.join(MIGRATIONS, f), "utf8").trimEnd());
  parts.push("");
}

// Record the ledger so the app's own migrator treats this database as
// already migrated and does not replay any file on first boot.
parts.push(`create table if not exists _spir_migrations (`);
parts.push(`  filename text primary key,`);
parts.push(`  applied_at timestamptz not null default now()`);
parts.push(`);`);
parts.push(`insert into _spir_migrations(filename) values`);
parts.push(files.map((f) => `  ('${f}')`).join(",\n"));
parts.push(`on conflict do nothing;`);
parts.push(`create table if not exists _spir_meta (k text primary key);`);
parts.push(`insert into _spir_meta(k) values ('bootstrapped') on conflict do nothing;`);

fs.writeFileSync(OUT, parts.join("\n") + "\n");
console.log(`schema.sql rebuilt from ${files.length} migrations (${(fs.statSync(OUT).size / 1024).toFixed(0)} KB)`);
