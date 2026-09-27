/**
 * The web version's local database (Postgres in the browser) gets the same
 * schema as every installed computer and hosted database: the migration files
 * of supabase/migrations, in order, recorded in the same `_spir_migrations`
 * ledger. They arrive as one bundle (/spir/migrations.json, made at build).
 *
 * Pending migrations run as ONE statement batch: in the browser every
 * statement is otherwise written to IndexedDB on its own, and 119 migrations
 * took half a minute; as one batch they take about two seconds, and a batch
 * that fails leaves nothing half-applied. Like the server's migrator, the
 * batch runs with `spir.syncing` on (migrations never enter the change log),
 * then re-attaches the change log and the sync guard to every table.
 *
 * No imports: the tests run this file as it is.
 */

export interface LocalDb {
  exec(sql: string): Promise<unknown>;
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Migration { name: string; sql: string }

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Apply what is missing; returns the names applied. */
export async function migrateLocal(db: LocalDb, migrations: Migration[]): Promise<string[]> {
  await db.exec(`do $$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  end $$;
  create table if not exists _spir_migrations (filename text primary key, applied_at timestamptz not null default now());`);
  const done = new Set((await db.query<{ filename: string }>(`select filename from _spir_migrations`)).rows.map((r) => r.filename));
  const pending = [...migrations].sort((a, b) => a.name.localeCompare(b.name)).filter((m) => !done.has(m.name));
  if (pending.length === 0) return [];
  const batch = [
    `select set_config('spir.syncing', 'on', false);`,
    ...pending.map((m) => `${m.sql}\n;\ninsert into _spir_migrations (filename) values (${lit(m.name)}) on conflict do nothing;`),
    `do $$ begin
       if to_regprocedure('_spir_attach_change_log()') is not null then perform _spir_attach_change_log(); end if;
       if to_regprocedure('_spir_guard_triggers()') is not null then perform _spir_guard_triggers(); end if;
     end $$;`,
    `create table if not exists _spir_meta (k text primary key);
     insert into _spir_meta (k) values ('bootstrapped') on conflict do nothing;`,
  ].join("\n");
  try {
    await db.exec(batch);
  } finally {
    // Whatever happened, later writes must be logged again.
    await db.exec(`select set_config('spir.syncing', 'off', false);`).catch(() => undefined);
  }
  return pending.map((m) => m.name);
}
