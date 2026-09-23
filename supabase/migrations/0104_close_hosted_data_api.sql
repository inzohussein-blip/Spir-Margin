-- =====================================================================
-- Migration 0104 : Close the hosted database's public data API
--
-- Supabase publishes every table in `public` through its REST API, to two
-- roles: `anon` (anyone holding the project's public key) and
-- `authenticated` (anyone who signs up through Supabase Auth). The
-- policies written for the early supabase-js version of this app let
-- `authenticated` read and write everything, password hashes included, and
-- the sync tables from 0089 on have no row security at all, so `anon` could
-- read the whole change log, or write into it a change that every computer
-- would then pull in and apply.
--
-- The app never uses that API. The server reaches a hosted database only
-- over a direct Postgres connection (DATABASE_URL, as the database owner),
-- so the two API roles lose every privilege on `public`: existing tables,
-- sequences and functions, and anything created later. Functions also lose
-- their default grant to PUBLIC, which the API roles inherit.
--
-- On the embedded database there are no such roles and this does nothing.
-- =====================================================================

do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
        return;
    end if;

    revoke all on all tables    in schema public from anon, authenticated;
    revoke all on all sequences in schema public from anon, authenticated;
    revoke all on all functions in schema public from anon, authenticated, public;

    alter default privileges in schema public revoke all on tables    from anon, authenticated;
    alter default privileges in schema public revoke all on sequences from anon, authenticated;
    alter default privileges in schema public revoke all on functions from anon, authenticated, public;
end $$;
