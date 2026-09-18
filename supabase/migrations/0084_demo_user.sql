-- =====================================================================
-- Migration 0084 : Demo login account
--
-- A ready-to-use demo administrator so the platform can be explored right
-- after the schema is applied — on the embedded PGlite backend and on a hosted
-- Postgres (Supabase) database alike.
--
-- Credentials: demo@spir.local / demo1234  (role: admin)
--
-- Idempotent (fn_create_user skips an existing email). In a real production
-- database, DISABLE or change this account after first sign-in:
--     update app_users set is_active = false where email = 'demo@spir.local';
-- =====================================================================

select fn_create_user('demo@spir.local', 'demo1234', 'Demo User', 'admin');
