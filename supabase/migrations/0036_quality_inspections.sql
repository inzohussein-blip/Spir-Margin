-- =====================================================================
-- Migration 0036 : Quality Inspection (incoming/outgoing QC)
--
-- Ported (lightened) from ERPNext "Quality Inspection" (+ reading rows).
-- Records a QC check against a product / kit batch / device with a set of
-- parameter readings. fn_evaluate_quality_inspection() auto-grades numeric
-- readings against their min/max and rolls the pass/fail up to the header.
-- =====================================================================

do $$ begin
    create type qi_inspection_type as enum ('incoming','outgoing','in_process');
exception when duplicate_object then null; end $$;

do $$ begin
    create type qi_status as enum ('pending','accepted','rejected','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type qi_reading_status as enum ('accepted','rejected');
exception when duplicate_object then null; end $$;

create table if not exists quality_inspections (
    id              uuid primary key default gen_random_uuid(),
    qi_no           text not null unique,
    report_date     date not null default current_date,
    inspection_type qi_inspection_type not null default 'incoming',
    status          qi_status not null default 'pending',
    product_id      uuid references products(id) on delete set null,
    batch_id        uuid references kit_batches(id) on delete set null,
    device_id       uuid references devices(id) on delete set null,
    sample_size     numeric(14,2) not null default 1,
    inspected_by    text,
    remarks         text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists idx_qi_status on quality_inspections(status);
create index if not exists idx_qi_batch on quality_inspections(batch_id);
create index if not exists idx_qi_device on quality_inspections(device_id);

create table if not exists quality_inspection_readings (
    id            uuid primary key default gen_random_uuid(),
    qi_id         uuid not null references quality_inspections(id) on delete cascade,
    parameter     text not null,
    numeric_check boolean not null default true,   -- numeric vs textual criterion
    reading_value numeric(14,4),
    value         text,                            -- textual reading
    min_value     numeric(14,4),
    max_value     numeric(14,4),
    status        qi_reading_status not null default 'accepted',
    created_at    timestamptz not null default now()
);

create index if not exists idx_qireadings_qi on quality_inspection_readings(qi_id);

-- Grade numeric readings against min/max, then roll pass/fail up to the
-- header (rejected if any reading fails). Returns the resulting status.
create or replace function fn_evaluate_quality_inspection(p_qi_id uuid)
returns qi_status language plpgsql as $$
declare
    v_rejected integer;
    v_result   qi_status;
begin
    -- auto-grade numeric readings that carry bounds
    update quality_inspection_readings r set
        status = case
            when (r.min_value is not null and r.reading_value < r.min_value)
              or (r.max_value is not null and r.reading_value > r.max_value)
            then 'rejected'::qi_reading_status
            else 'accepted'::qi_reading_status
        end
    where r.qi_id = p_qi_id
      and r.numeric_check
      and r.reading_value is not null
      and (r.min_value is not null or r.max_value is not null);

    select count(*) into v_rejected
    from quality_inspection_readings
    where qi_id = p_qi_id and status = 'rejected';

    v_result := case when v_rejected > 0 then 'rejected'::qi_status else 'accepted'::qi_status end;

    update quality_inspections
    set status = v_result, updated_at = now()
    where id = p_qi_id and status not in ('cancelled');

    return v_result;
end $$;

do $$
declare t text;
begin
    foreach t in array array['quality_inspections','quality_inspection_readings']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
