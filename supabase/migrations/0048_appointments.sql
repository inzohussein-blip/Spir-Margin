-- =====================================================================
-- Migration 0048 : Appointment (install / service visit scheduling)
--
-- Ported (lightened) from ERPNext "Appointment", reframed for scheduling an
-- installation, service, or training visit at a lab (optionally for a device).
-- =====================================================================

do $$ begin
    create type appointment_status as enum ('open','confirmed','completed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type appointment_purpose as enum ('installation','service','training','other');
exception when duplicate_object then null; end $$;

create table if not exists appointments (
    id             uuid primary key default gen_random_uuid(),
    appointment_no text not null unique,
    lab_id         uuid references labs(id) on delete set null,
    device_id      uuid references devices(id) on delete set null,
    purpose        appointment_purpose not null default 'service',
    scheduled_time timestamptz not null default now(),
    status         appointment_status not null default 'open',
    contact_name   text,
    contact_phone  text,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_appts_status on appointments(status);
create index if not exists idx_appts_time on appointments(scheduled_time);

do $$ begin
    execute 'alter table appointments enable row level security';
    execute 'drop policy if exists "authenticated_all" on appointments';
    execute 'create policy "authenticated_all" on appointments for all to authenticated using (true) with check (true)';
end $$;
