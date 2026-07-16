-- =====================================================================
-- Migration 0058 : Delivery Trip
--
-- Ported (lightened) from ERPNext "Delivery Trip": groups delivery notes into a
-- single route with a driver/vehicle and an ordered list of stops (each a lab,
-- optionally tied to a Delivery Note). Starting the trip marks it in transit;
-- completing it marks the trip done and every stop as arrived.
-- =====================================================================

do $$ begin
    create type delivery_trip_status as enum ('draft','scheduled','in_transit','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists delivery_trips (
    id             uuid primary key default gen_random_uuid(),
    trip_no        text not null unique,
    driver_name    text,
    vehicle        text,
    departure_date date not null default current_date,
    status         delivery_trip_status not null default 'draft',
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_deltrip_status on delivery_trips(status);

create table if not exists delivery_trip_stops (
    id               uuid primary key default gen_random_uuid(),
    trip_id          uuid not null references delivery_trips(id) on delete cascade,
    lab_id           uuid references labs(id) on delete set null,
    delivery_note_id uuid references delivery_notes(id) on delete set null,
    address          text,
    seq              integer not null default 1,
    arrived          boolean not null default false,
    created_at       timestamptz not null default now()
);

create index if not exists idx_deltripstops_t on delivery_trip_stops(trip_id);

-- Depart: draft/scheduled -> in_transit.
create or replace function fn_start_delivery_trip(p_trip_id uuid)
returns void language plpgsql as $$
declare v_t delivery_trips%rowtype;
begin
    select * into v_t from delivery_trips where id = p_trip_id for update;
    if not found then raise exception 'Delivery trip % not found', p_trip_id; end if;
    if v_t.status not in ('draft','scheduled') then
        raise exception 'Delivery trip % cannot start from %', v_t.trip_no, v_t.status;
    end if;
    if not exists (select 1 from delivery_trip_stops where trip_id = p_trip_id) then
        raise exception 'Delivery trip % has no stops', v_t.trip_no;
    end if;
    update delivery_trips set status = 'in_transit', updated_at = now() where id = p_trip_id;
end $$;

-- Arrive at all stops and close the trip. Returns the number of stops delivered.
create or replace function fn_complete_delivery_trip(p_trip_id uuid)
returns integer language plpgsql as $$
declare v_t delivery_trips%rowtype; v_count integer;
begin
    select * into v_t from delivery_trips where id = p_trip_id for update;
    if not found then raise exception 'Delivery trip % not found', p_trip_id; end if;
    if v_t.status = 'completed' then raise exception 'Delivery trip % already completed', v_t.trip_no; end if;
    if v_t.status = 'cancelled' then raise exception 'Delivery trip % is cancelled', v_t.trip_no; end if;

    update delivery_trip_stops set arrived = true where trip_id = p_trip_id;
    select count(*) into v_count from delivery_trip_stops where trip_id = p_trip_id;
    update delivery_trips set status = 'completed', updated_at = now() where id = p_trip_id;
    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['delivery_trips','delivery_trip_stops']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
