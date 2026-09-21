-- =====================================================================
-- Migration 0086 : Restore pgcrypto reach for the auth helpers
--
-- Migration 0085 pinned `search_path` to `public, pg_temp` on every
-- fn_* / trg_* function. On hosted Supabase, `gen_salt` and `crypt`
-- (from pgcrypto) live in the `extensions` schema, so the three auth
-- helpers stopped resolving them and calls to fn_create_user /
-- fn_set_password / fn_verify_login failed with "function gen_salt does
-- not exist".
--
-- Add `extensions` to the search_path for those three functions.
-- =====================================================================

alter function public.fn_verify_login(text, text)
    set search_path = public, extensions, pg_temp;

alter function public.fn_set_password(uuid, text)
    set search_path = public, extensions, pg_temp;

alter function public.fn_create_user(text, text, text, app_user_role)
    set search_path = public, extensions, pg_temp;
