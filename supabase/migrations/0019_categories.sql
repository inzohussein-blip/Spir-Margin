-- =====================================================================
-- Migration 0019 : Asset Category & Supplier Group
--
-- Ported from ERPNext "Asset Category" and "Supplier Group". Simple masters:
-- a device carries an asset category; a company (supplier) a supplier group.
-- =====================================================================

create table if not exists asset_categories (
    id                     uuid primary key default gen_random_uuid(),
    name                   text not null unique,
    non_depreciable        boolean not null default false
);

create table if not exists supplier_groups (
    id                    uuid primary key default gen_random_uuid(),
    name                  text not null unique,
    parent_supplier_group text,
    is_group              boolean not null default false
);

alter table devices   add column if not exists asset_category text;
alter table companies add column if not exists supplier_group text;

insert into asset_categories (name) values
    ('Chemistry Analyzers'), ('Hematology Analyzers'),
    ('Immunoassay Analyzers'), ('Microscopes'), ('Centrifuges')
on conflict (name) do nothing;

insert into supplier_groups (name, is_group) values
    ('All Supplier Groups', true), ('Manufacturers', false),
    ('Distributors', false), ('Local Suppliers', false)
on conflict (name) do nothing;

do $$
declare t text;
begin
    foreach t in array array['asset_categories', 'supplier_groups']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
