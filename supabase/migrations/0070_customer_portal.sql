-- =====================================================================
-- Migration 0070 : Customer portal (ported idea from Odoo)
--
-- Hospitals get a heavily-restricted login (role 'customer') bound to their
-- lab. A portal user can only ever see their OWN lab's devices and maintenance
-- history and open fault tickets — enforced server-side from the session, never
-- from client input.
-- =====================================================================

-- New restricted role. ADD VALUE must be its own statement (a new enum label
-- cannot be *used* in the same transaction it is created, but the runtime
-- function bodies below only reference it when they execute, after commit).
alter type app_user_role add value if not exists 'customer';

-- Bind a user to a lab (only meaningful for the 'customer' role).
alter table app_users add column if not exists lab_id uuid references labs(id) on delete set null;

-- Login now also returns the bound lab so the session can carry it. The return
-- shape changes, so the old function must be dropped first.
drop function if exists fn_verify_login(text, text);
create or replace function fn_verify_login(p_email text, p_password text)
returns table(id uuid, email text, full_name text, role app_user_role, lab_id uuid)
language sql as $$
    select u.id, u.email, u.full_name, u.role, u.lab_id
    from app_users u
    where lower(u.email) = lower(p_email)
      and u.is_active
      and u.password_hash = crypt(p_password, u.password_hash);
$$;

-- Create a portal (customer) user bound to a specific lab.
create or replace function fn_create_portal_user(p_email text, p_password text, p_full_name text, p_lab_id uuid)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
    insert into app_users (email, password_hash, full_name, role, lab_id)
    values (lower(p_email), crypt(p_password, gen_salt('bf')), p_full_name, 'customer', p_lab_id)
    on conflict (email) do update set lab_id = excluded.lab_id, role = 'customer'
    returning id into v_id;
    return v_id;
end $$;
