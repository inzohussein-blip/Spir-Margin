-- =====================================================================
-- Migration 0093 : Where the hosted database is configured
--
-- The welcome screen promises "add a hosted database later and the work
-- already done here will sync up to it". That was true of the engine but not
-- of the operator: the connection string could only come from DATABASE_URL,
-- which means editing environment variables and restarting — not something a
-- single company without an operations team can do.
--
-- It lives here instead, so it can be set, tested and cleared from Settings.
-- DATABASE_URL still wins when it is set, so an existing hosted deployment
-- keeps behaving exactly as before and nothing in the UI can override how a
-- server was deployed.
--
-- This table is local on purpose. It is excluded from the change log (its
-- name starts with `_spir`), so one machine's connection string never syncs
-- onto another — each machine says for itself where it syncs to.
-- =====================================================================

create table if not exists _spir_peer (
    only_row      boolean primary key default true check (only_row),
    database_url  text,
    updated_at    timestamptz not null default now()
);
insert into _spir_peer (only_row) values (true) on conflict do nothing;
