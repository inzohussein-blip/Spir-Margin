-- =====================================================================
-- Migration 0043 : Maintenance Schedule (recurring PM plan for a device)
--
-- Ported (lightened) from ERPNext "Maintenance Schedule" (+ detail rows).
-- A recurring preventive-maintenance plan for one device: pick a periodicity
-- and a number of visits, and fn_generate_maintenance_schedule() lays out the
-- dated visit rows. Pairs with Maintenance Visit (which records the actual
-- service) and feeds the device-maintenance-alerts view.
-- =====================================================================

do $$ begin
    create type maintenance_periodicity as enum
        ('weekly','monthly','quarterly','half_yearly','yearly');
exception when duplicate_object then null; end $$;

do $$ begin
    create type maintenance_schedule_status as enum ('draft','active','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type schedule_detail_status as enum ('pending','done');
exception when duplicate_object then null; end $$;

create table if not exists maintenance_schedules (
    id           uuid primary key default gen_random_uuid(),
    schedule_no  text not null unique,
    lab_id       uuid references labs(id) on delete set null,
    device_id    uuid not null references devices(id) on delete restrict,
    periodicity  maintenance_periodicity not null default 'quarterly',
    start_date   date not null default current_date,
    no_of_visits integer not null default 4 check (no_of_visits > 0),
    status       maintenance_schedule_status not null default 'draft',
    notes        text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

create index if not exists idx_mscheds_device on maintenance_schedules(device_id);
create index if not exists idx_mscheds_status on maintenance_schedules(status);

create table if not exists maintenance_schedule_details (
    id                uuid primary key default gen_random_uuid(),
    schedule_id       uuid not null references maintenance_schedules(id) on delete cascade,
    scheduled_date    date not null,
    completion_status schedule_detail_status not null default 'pending',
    actual_date       date,
    created_at        timestamptz not null default now()
);

create index if not exists idx_mscheddetails_sched on maintenance_schedule_details(schedule_id);
create index if not exists idx_mschedetails_date on maintenance_schedule_details(scheduled_date);

-- Lay out the visit rows for a schedule (idempotent: clears + regenerates the
-- pending rows), activate it, and set the device's next-maintenance date to
-- the first pending visit. Returns the number of rows generated.
create or replace function fn_generate_maintenance_schedule(p_schedule_id uuid)
returns integer language plpgsql as $$
declare
    v_sched maintenance_schedules%rowtype;
    v_step  interval;
    v_date  date;
    i       integer;
begin
    select * into v_sched from maintenance_schedules where id = p_schedule_id for update;
    if not found then raise exception 'Maintenance schedule % not found', p_schedule_id; end if;
    if v_sched.status = 'cancelled' then
        raise exception 'Schedule % is cancelled', v_sched.schedule_no;
    end if;

    v_step := case v_sched.periodicity
        when 'weekly'      then interval '1 week'
        when 'monthly'     then interval '1 month'
        when 'quarterly'   then interval '3 months'
        when 'half_yearly' then interval '6 months'
        when 'yearly'      then interval '1 year'
    end;

    -- clear any not-yet-done rows and regenerate from start_date
    delete from maintenance_schedule_details
    where schedule_id = p_schedule_id and completion_status = 'pending';

    for i in 0 .. v_sched.no_of_visits - 1 loop
        v_date := (v_sched.start_date + (v_step * i))::date;
        insert into maintenance_schedule_details (schedule_id, scheduled_date)
        values (p_schedule_id, v_date);
    end loop;

    update maintenance_schedules set status = 'active', updated_at = now()
    where id = p_schedule_id;

    -- surface the earliest upcoming visit on the device
    update devices set
        maintenance_required = true,
        next_maintenance_date = (
            select min(scheduled_date) from maintenance_schedule_details
            where schedule_id = p_schedule_id and completion_status = 'pending'
              and scheduled_date >= current_date
        ),
        updated_at = now()
    where id = v_sched.device_id;

    return v_sched.no_of_visits;
end $$;

do $$
declare t text;
begin
    foreach t in array array['maintenance_schedules','maintenance_schedule_details']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
