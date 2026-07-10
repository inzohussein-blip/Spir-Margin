-- =====================================================================
-- Migration 0013 : Reference masters
--
-- Ported from ERPNext DocTypes UOM, Brand, Item Group and Mode of Payment.
-- These are controlled-vocabulary masters that back the free-text fields
-- already on products / payments, so dropdowns replace ad-hoc typing.
-- (Processed one-by-one from erpnext-reference; sources deleted.)
-- =====================================================================

-- UOM ------------------------------------------------------------------
create table if not exists uoms (
    id                   uuid primary key default gen_random_uuid(),
    uom_name             text not null unique,
    symbol               text,
    must_be_whole_number boolean not null default false,
    enabled              boolean not null default true,
    description          text
);

-- Brand ----------------------------------------------------------------
create table if not exists brands (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text
);

-- Item Group -----------------------------------------------------------
create table if not exists item_groups (
    id                uuid primary key default gen_random_uuid(),
    name              text not null unique,
    parent_item_group text,
    is_group          boolean not null default false
);

-- Mode of Payment ------------------------------------------------------
do $$ begin
    create type mode_of_payment_type as enum ('cash', 'bank', 'general');
exception when duplicate_object then null; end $$;

create table if not exists modes_of_payment (
    id      uuid primary key default gen_random_uuid(),
    name    text not null unique,
    type    mode_of_payment_type not null default 'general',
    enabled boolean not null default true
);

-- Seeds ----------------------------------------------------------------
insert into uoms (uom_name, symbol, must_be_whole_number) values
    ('Nos', 'Nos', true), ('Box', 'Box', true), ('Unit', 'Unit', true),
    ('Pack', 'Pack', true), ('Vial', 'Vial', true), ('Test', 'Test', true),
    ('Litre', 'L', false), ('Millilitre', 'mL', false), ('Kg', 'kg', false)
on conflict (uom_name) do nothing;

insert into brands (name) values ('Roche'), ('Siemens'), ('Sysmex'), ('Abbott'), ('Beckman Coulter')
on conflict (name) do nothing;

insert into item_groups (name, is_group) values
    ('Devices', false), ('Reagents', false), ('Spare Parts', false), ('Consumables', false)
on conflict (name) do nothing;

insert into modes_of_payment (name, type) values
    ('Cash', 'cash'), ('Wire Transfer', 'bank'), ('Cheque', 'bank'), ('Card', 'bank')
on conflict (name) do nothing;

-- RLS ------------------------------------------------------------------
do $$
declare t text;
begin
    foreach t in array array['uoms', 'brands', 'item_groups', 'modes_of_payment']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
