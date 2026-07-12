-- =====================================================================
-- Migration 0034 : Maintenance Visit (device service records)
--
-- Ported (lightened) from ERPNext "Maintenance Visit" (+ purpose rows).
-- A visit records a service call to a lab covering one or more devices:
-- preventive (scheduled), unscheduled, or breakdown. On submit each
-- serviced device gets a maintenance_logs row and its next-maintenance
-- date is rolled forward.
-- =====================================================================

do $$ begin
    create type maintenance_type as enum ('scheduled','unscheduled','breakdown');
exception when duplicate_object then null; end $$;

do $$ begin
    create type maintenance_completion as enum ('pending','partial','full');
exception when duplicate_object then null; end $$;

do $$ begin
    create type maintenance_visit_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists maintenance_visits (
    id                uuid primary key default gen_random_uuid(),
    visit_no          text not null unique,
    lab_id            uuid references labs(id) on delete set null,
    visit_date        date not null default current_date,
    visit_time        time,
    maintenance_type  maintenance_type not null default 'scheduled',
    completion_status maintenance_completion not null default 'pending',
    status            maintenance_visit_status not null default 'draft',
    service_person    text,
    customer_feedback text,
    notes             text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_mvisits_lab on maintenance_visits(lab_id);
create index if not exists idx_mvisits_status on maintenance_visits(status);
create index if not exists idx_mvisits_date on maintenance_visits(visit_date);

create table if not exists maintenance_visit_purposes (
    id             uuid primary key default gen_random_uuid(),
    visit_id       uuid not null references maintenance_visits(id) on delete cascade,
    device_id      uuid references devices(id) on delete set null,
    work_done      text,
    service_person text,
    next_due_date  date,
    created_at     timestamptz not null default now()
);

create index if not exists idx_mvpurposes_visit on maintenance_visit_purposes(visit_id);

-- Submit a visit: log each serviced device and roll its next-maintenance
-- date forward. A breakdown visit clears the device's in_maintenance state
-- back to installed (it is fixed and returned to service in the lab).
create or replace function fn_submit_maintenance_visit(p_visit_id uuid)
returns integer language plpgsql as $$
declare
    v_visit maintenance_visits%rowtype;
    v_row   record;
    v_count integer := 0;
begin
    select * into v_visit from maintenance_visits where id = p_visit_id for update;
    if not found then raise exception 'Maintenance visit % not found', p_visit_id; end if;
    if v_visit.status = 'submitted' then
        raise exception 'Visit % already submitted', v_visit.visit_no;
    end if;
    if v_visit.status = 'cancelled' then
        raise exception 'Visit % is cancelled', v_visit.visit_no;
    end if;

    for v_row in
        select * from maintenance_visit_purposes where visit_id = p_visit_id and device_id is not null
    loop
        insert into maintenance_logs (device_id, performed_on, performed_by, description, next_due_date)
        values (v_row.device_id, v_visit.visit_date,
                coalesce(v_row.service_person, v_visit.service_person),
                v_row.work_done, v_row.next_due_date);

        update devices set
            next_maintenance_date = coalesce(v_row.next_due_date, next_maintenance_date),
            status = case when status = 'in_maintenance' then 'installed'::device_status else status end,
            updated_at = now()
        where id = v_row.device_id;

        v_count := v_count + 1;
    end loop;

    update maintenance_visits set status = 'submitted', updated_at = now()
    where id = p_visit_id;

    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['maintenance_visits','maintenance_visit_purposes']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
