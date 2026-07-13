-- =====================================================================
-- Migration 0045 : Support Issue (device support tickets)
--
-- Ported (lightened) from ERPNext "Issue" (+ Issue Type, Issue Priority).
-- A support ticket raised by a lab, optionally about a specific device,
-- with a simple status workflow and resolution capture.
-- =====================================================================

do $$ begin
    create type issue_status as enum ('open','replied','on_hold','resolved','closed');
exception when duplicate_object then null; end $$;

create table if not exists issue_types (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text
);

create table if not exists issue_priorities (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text
);

create table if not exists issues (
    id                 uuid primary key default gen_random_uuid(),
    issue_no           text not null unique,
    subject            text not null,
    lab_id             uuid references labs(id) on delete set null,
    device_id          uuid references devices(id) on delete set null,
    raised_by          text,
    status             issue_status not null default 'open',
    priority           text,
    issue_type         text,
    description        text,
    resolution_details text,
    opening_date       date not null default current_date,
    resolved_on        date,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index if not exists idx_issues_status on issues(status);
create index if not exists idx_issues_lab on issues(lab_id);
create index if not exists idx_issues_device on issues(device_id);

-- Move an issue to a new status; stamp resolved_on when it is closed out,
-- clear it when re-opened.
create or replace function fn_set_issue_status(p_id uuid, p_status issue_status)
returns void language plpgsql as $$
begin
    update issues set
        status = p_status,
        resolved_on = case
            when p_status in ('resolved','closed') then coalesce(resolved_on, current_date)
            else null
        end,
        updated_at = now()
    where id = p_id;
end $$;

insert into issue_types (name) values ('Hardware'), ('Software'), ('Consumable'), ('Installation')
on conflict (name) do nothing;

insert into issue_priorities (name) values ('Low'), ('Medium'), ('High'), ('Urgent')
on conflict (name) do nothing;

do $$
declare t text;
begin
    foreach t in array array['issue_types','issue_priorities','issues']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
