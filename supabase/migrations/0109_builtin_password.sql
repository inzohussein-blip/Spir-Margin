-- =====================================================================
-- Migration 0109 : The built-in account's password can be changed
--
-- The built-in account (admin@spir.local) lives in code so that sign-in
-- works on a fresh, offline install — and its password, 123, was fixed and
-- printed on the sign-in page. Its password can now be changed per
-- computer. Only the hash is kept, here, in a `_spir` table: local to this
-- computer, never synced (each computer's administrator sets their own).
-- While no password has been set, 123 still works, and the sign-in page
-- still says so.
-- =====================================================================

create table if not exists _spir_builtin (
    only_row      boolean primary key default true check (only_row),
    password_hash text,
    changed_at    timestamptz
);
insert into _spir_builtin (only_row) values (true) on conflict do nothing;
