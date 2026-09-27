-- =====================================================================
-- Migration 0118 : Cold chain & calibration (التبريد والمعايرة)
--
-- Ported from spir-lab-manager's quality station, for a company that keeps
-- reagents and kits cold: its fridges, freezers and store rooms each have a
-- safe range, and someone reads the temperature morning and evening; a
-- reading outside the range is marked with what was done about it. Its own
-- instruments (thermometers, pipettes, centrifuges, test equipment) have a
-- calibration interval, routine tasks and a log of maintenance, faults and
-- calibrations.
--
-- One reading per unit per day per slot: its id is derived from the three,
-- so two computers that record the same reading write the same row.
-- Nothing is seeded.
-- =====================================================================

create table if not exists cc_storage_units (
    id            uuid primary key default gen_random_uuid(),
    name          text not null unique,
    kind          text not null default 'fridge' check (kind in ('fridge', 'freezer', 'room', 'incubator', 'other')),
    warehouse_id  uuid references warehouses(id) on delete set null,
    min_temp      numeric(6, 2) not null,
    max_temp      numeric(6, 2) not null,
    is_active     boolean not null default true,
    notes         text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now(),
    check (max_temp > min_temp)
);
create index if not exists idx_cc_units_warehouse on cc_storage_units(warehouse_id);

create table if not exists cc_readings (
    id            uuid primary key,
    unit_id       uuid not null references cc_storage_units(id) on delete cascade,
    reading_date  date not null,
    slot          text not null check (slot in ('AM', 'PM')),
    value         numeric(6, 2) not null,
    recorded_by   text,
    action        text,
    updated_at    timestamptz not null default now(),
    unique (unit_id, reading_date, slot)
);
create index if not exists idx_cc_readings_date on cc_readings(reading_date);

create table if not exists cc_equipment (
    id               uuid primary key default gen_random_uuid(),
    name             text not null,
    model            text,
    serial_no        text,
    location         text,
    vendor           text,
    vendor_phone     text,
    installed_on     date,
    calib_months     int check (calib_months is null or calib_months between 1 and 120),
    last_calibrated  date,
    is_active        boolean not null default true,
    notes            text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists cc_equipment_tasks (
    id            uuid primary key default gen_random_uuid(),
    equipment_id  uuid not null references cc_equipment(id) on delete cascade,
    name          text not null,
    freq          text not null check (freq in ('daily', 'weekly', 'monthly', 'quarterly', 'yearly')),
    last_done     date,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists idx_cc_tasks_equipment on cc_equipment_tasks(equipment_id);

create table if not exists cc_equipment_log (
    id              uuid primary key default gen_random_uuid(),
    equipment_id    uuid not null references cc_equipment(id) on delete cascade,
    log_date        date not null default current_date,
    log_type        text not null check (log_type in ('maintenance', 'fault', 'calibration')),
    details         text not null,
    action          text,
    downtime_hours  numeric(8, 2) check (downtime_hours is null or downtime_hours >= 0),
    resolved        boolean not null default true,
    recorded_by     text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index if not exists idx_cc_log_equipment on cc_equipment_log(equipment_id);

/** A temperature reading (null clears it). The id comes from the unit, the day and the slot. */
create or replace function fn_cc_set_reading(p_unit uuid, p_date date, p_slot text, p_value numeric, p_by text default null, p_action text default null)
returns void language plpgsql as $$
begin
    if p_slot not in ('AM', 'PM') then
        raise exception 'الفترة يجب أن تكون صباحاً أو مساءً.';
    end if;
    if p_value is null then
        delete from cc_readings where unit_id = p_unit and reading_date = p_date and slot = p_slot;
        return;
    end if;
    if p_value < -90 or p_value > 90 then
        raise exception 'درجة الحرارة % غير معقولة.', p_value;
    end if;
    insert into cc_readings (id, unit_id, reading_date, slot, value, recorded_by, action)
    values (md5('cc|' || p_unit::text || '|' || p_date::text || '|' || p_slot)::uuid, p_unit, p_date, p_slot, p_value,
            nullif(trim(coalesce(p_by, '')), ''), nullif(trim(coalesce(p_action, '')), ''))
    on conflict (id) do update
       set value = excluded.value, recorded_by = excluded.recorded_by, action = excluded.action, updated_at = now();
end $$;

/** A calibration entry also moves the instrument's last calibration date forward. */
create or replace function fn_cc_log_calibrated() returns trigger language plpgsql as $$
begin
    if new.log_type = 'calibration' then
        update cc_equipment
           set last_calibrated = greatest(coalesce(last_calibrated, new.log_date), new.log_date), updated_at = now()
         where id = new.equipment_id;
    end if;
    return new;
end $$;
drop trigger if exists trg_cc_log_calibrated on cc_equipment_log;
create trigger trg_cc_log_calibrated after insert on cc_equipment_log
    for each row execute function fn_cc_log_calibrated();

select _spir_attach_change_log();
select _spir_guard_triggers();
