-- =====================================================================
-- Migration 0049 : Maintenance Team + Task
--
-- Ported (lightened) from ERPNext "Asset Maintenance Team" (+ member rows)
-- and "Asset Maintenance Task". A team of people responsible for device
-- maintenance, plus its recurring task checklist. A PM schedule can be
-- assigned to a team.
-- =====================================================================

do $$ begin
    create type maintenance_task_type as enum ('preventive','calibration');
exception when duplicate_object then null; end $$;

do $$ begin
    create type maintenance_task_status as enum ('planned','overdue','done','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists maintenance_teams (
    id           uuid primary key default gen_random_uuid(),
    name         text not null unique,
    manager_name text,
    description  text,
    created_at   timestamptz not null default now()
);

create table if not exists maintenance_team_members (
    id          uuid primary key default gen_random_uuid(),
    team_id     uuid not null references maintenance_teams(id) on delete cascade,
    member_name text not null,
    role        text,
    created_at  timestamptz not null default now()
);

create index if not exists idx_mtmembers_team on maintenance_team_members(team_id);

create table if not exists maintenance_tasks (
    id               uuid primary key default gen_random_uuid(),
    team_id          uuid references maintenance_teams(id) on delete set null,
    task_name        text not null,
    maintenance_type maintenance_task_type not null default 'preventive',
    periodicity      text,
    start_date       date,
    end_date         date,
    status           maintenance_task_status not null default 'planned',
    created_at       timestamptz not null default now()
);

create index if not exists idx_mtasks_team on maintenance_tasks(team_id);

alter table maintenance_schedules
    add column if not exists team_id uuid references maintenance_teams(id) on delete set null;

do $$
declare t text;
begin
    foreach t in array array['maintenance_teams','maintenance_team_members','maintenance_tasks']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
