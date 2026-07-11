-- =====================================================================
-- Migration 0031 : Warehouse Type, Sales Person, Sales Partner
--
-- Ported from ERPNext masters. Warehouse Type backs the warehouses.
-- warehouse_type field; Sales Person / Sales Partner are the sales team /
-- channel masters (with commission rate).
-- =====================================================================

create table if not exists warehouse_types (
    id          uuid primary key default gen_random_uuid(),
    name        text not null unique,
    description text
);

create table if not exists sales_persons (
    id                 uuid primary key default gen_random_uuid(),
    name               text not null unique,
    parent_sales_person text,
    commission_rate    numeric(6,2) not null default 0,
    is_group           boolean not null default false,
    enabled            boolean not null default true
);

create table if not exists sales_partners (
    id              uuid primary key default gen_random_uuid(),
    name            text not null unique,
    partner_type    text,
    territory       text,
    commission_rate numeric(6,2) not null default 0,
    referral_code   text
);

insert into warehouse_types (name) values ('Stock'), ('Cold'), ('Transit'), ('Rejected')
on conflict (name) do nothing;

insert into sales_persons (name, commission_rate, is_group) values
    ('Sales Team', 0, true), ('Ali Hassan', 5, false), ('Sara Kareem', 5, false)
on conflict (name) do nothing;

insert into sales_partners (name, partner_type, commission_rate) values
    ('MedSupply Co', 'Distributor', 8), ('LabDirect', 'Reseller', 6)
on conflict (name) do nothing;

do $$
declare t text;
begin
    foreach t in array array['warehouse_types','sales_persons','sales_partners']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
