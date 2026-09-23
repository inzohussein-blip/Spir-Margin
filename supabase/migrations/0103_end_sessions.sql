-- =====================================================================
-- Migration 0103 : Ending a user's sessions
--
-- A session is a signed cookie that stays valid for 7 days, and nothing
-- about it was checked against the user afterwards. So an administrator who
-- reset a leaked password, or disabled someone who had left, changed nothing
-- for a browser already signed in as them — for up to a week.
--
-- sessions_valid_after is the moment before which this user's sessions no
-- longer count. Setting a password moves it to now; the server compares it
-- (and is_active) with the session on every request, so a reset or a
-- disable takes effect on the next click. Changing one's own password
-- re-issues the session of the browser that did it, so only the others end.
-- =====================================================================

alter table app_users add column if not exists sessions_valid_after timestamptz;

create or replace function fn_set_password(p_user_id uuid, p_password text)
returns void language sql
set search_path = public, extensions, pg_temp
as $$
    update app_users
       set password_hash = crypt(p_password, gen_salt('bf')),
           sessions_valid_after = now(),
           updated_at = now()
     where id = p_user_id;
$$;
