-- =====================================================================
-- Migration 0083 : Persistent login throttle
--
-- The brute-force login throttle lived in process memory (globalThis), so it
-- reset on every restart/redeploy and was NOT shared across instances — on a
-- multi-instance or serverless deployment it barely slowed an attacker. This
-- moves the counters into the database so the lockout is durable and shared.
--
-- Policy (unchanged): 5 failures within a 15-minute window locks the email for
-- 15 minutes. A successful sign-in clears the counter.
-- =====================================================================

create table if not exists login_attempts (
    email        text primary key,
    fails        int  not null default 0,
    first_at     timestamptz not null default now(),
    locked_until timestamptz
);

-- Seconds remaining on a lockout for this email, or 0 if not locked.
create or replace function fn_login_lockout_remaining(p_email text)
returns int language plpgsql stable as $$
declare v timestamptz;
begin
    select locked_until into v from login_attempts where email = lower(p_email);
    if v is null or v <= now() then return 0; end if;
    return ceil(extract(epoch from (v - now())))::int;
end $$;

-- Record a failed attempt; locks the email once 5 fail within the window.
create or replace function fn_login_record_failure(p_email text)
returns void language plpgsql as $$
declare v login_attempts%rowtype; k text := lower(p_email);
begin
    select * into v from login_attempts where email = k for update;
    if not found or (now() - v.first_at) > interval '15 minutes' then
        insert into login_attempts (email, fails, first_at, locked_until)
        values (k, 1, now(), null)
        on conflict (email) do update set fails = 1, first_at = now(), locked_until = null;
        return;
    end if;
    update login_attempts
       set fails = v.fails + 1,
           locked_until = case when v.fails + 1 >= 5 then now() + interval '15 minutes' else locked_until end
     where email = k;
end $$;

-- Clear the counter after a successful sign-in.
create or replace function fn_login_record_success(p_email text)
returns void language plpgsql as $$
begin
    delete from login_attempts where email = lower(p_email);
end $$;

alter table login_attempts enable row level security;
drop policy if exists "authenticated_all" on login_attempts;
create policy "authenticated_all" on login_attempts
    for all to authenticated using (true) with check (true);
