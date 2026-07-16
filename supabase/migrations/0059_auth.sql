-- =====================================================================
-- Migration 0059 : Application authentication
--
-- A lightweight, self-contained user/login table so the app can be gated behind
-- a sign-in — independent of Supabase Auth, so it works identically on the
-- embedded PGlite backend and on a hosted Postgres (Supabase) database.
-- Passwords are hashed with pgcrypto bcrypt (crypt + gen_salt('bf')).
-- =====================================================================

create extension if not exists pgcrypto;

do $$ begin
    create type app_user_role as enum ('admin','manager','staff');
exception when duplicate_object then null; end $$;

create table if not exists app_users (
    id            uuid primary key default gen_random_uuid(),
    email         text not null unique,
    password_hash text not null,
    full_name     text,
    role          app_user_role not null default 'staff',
    is_active     boolean not null default true,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

-- Verify credentials; returns the (safe) user row only when the password matches.
create or replace function fn_verify_login(p_email text, p_password text)
returns table(id uuid, email text, full_name text, role app_user_role)
language sql as $$
    select u.id, u.email, u.full_name, u.role
    from app_users u
    where lower(u.email) = lower(p_email)
      and u.is_active
      and u.password_hash = crypt(p_password, u.password_hash);
$$;

-- Set / change a user's password (hashes with a fresh bcrypt salt).
create or replace function fn_set_password(p_user_id uuid, p_password text)
returns void language sql as $$
    update app_users
       set password_hash = crypt(p_password, gen_salt('bf')), updated_at = now()
     where id = p_user_id;
$$;

-- Create a user with a plaintext password (hashed on the way in). Idempotent by email.
create or replace function fn_create_user(p_email text, p_password text, p_full_name text, p_role app_user_role)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
    insert into app_users (email, password_hash, full_name, role)
    values (lower(p_email), crypt(p_password, gen_salt('bf')), p_full_name, p_role)
    on conflict (email) do nothing
    returning id into v_id;
    if v_id is null then select id into v_id from app_users where lower(email) = lower(p_email); end if;
    return v_id;
end $$;

-- Default administrator. CHANGE THIS PASSWORD after first login (Account page).
insert into app_users (email, password_hash, full_name, role)
values ('admin@spir.local', crypt('admin1234', gen_salt('bf')), 'Administrator', 'admin')
on conflict (email) do nothing;

alter table app_users enable row level security;
drop policy if exists "authenticated_all" on app_users;
create policy "authenticated_all" on app_users for all to authenticated using (true) with check (true);
