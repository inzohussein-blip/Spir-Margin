-- =====================================================================
-- Migration 0107 : No accounts with passwords everyone knows
--
-- 0059 created admin@spir.local / admin1234 and 0084 demo@spir.local /
-- demo1234, both administrators, in every database. The program has its own
-- built-in account (admin@spir.local, checked in code, see
-- src/lib/auth/demo-credentials.ts), so these two only ever added a second
-- and third way in with a published password.
--
-- They are removed where they still have those passwords. An install that
-- changed one and uses it as a real account keeps it. Each database runs
-- this itself, and migrations do not enter the change log, so nothing
-- travels by sync.
-- =====================================================================

-- crypt() lives in `extensions` on a hosted Supabase database.
select set_config('search_path', 'public, extensions, pg_temp', true);

delete from app_users u
 where (u.email = 'admin@spir.local' and u.password_hash = crypt('admin1234', u.password_hash))
    or (u.email = 'demo@spir.local'  and u.password_hash = crypt('demo1234',  u.password_hash));
