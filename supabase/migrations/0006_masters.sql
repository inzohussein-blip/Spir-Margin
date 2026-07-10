-- =====================================================================
-- Migration 0006 : Master-data fidelity
-- Extends companies / products / warehouses with a few fields ported
-- from their ERPNext DocTypes (Supplier, Item, Warehouse) so the master
-- screens carry the same core attributes.
-- =====================================================================

-- companies  <- ERPNext "Supplier"
do $$ begin
    create type supplier_type as enum ('company', 'individual', 'partnership');
exception when duplicate_object then null; end $$;

alter table companies
    add column if not exists tax_id       text,
    add column if not exists supplier_type supplier_type not null default 'company',
    add column if not exists is_disabled  boolean not null default false;

-- products  <- ERPNext "Item"
alter table products
    add column if not exists item_group    text,
    -- ERPNext Item reorder level -> low-stock alerting for kits/spares
    add column if not exists reorder_level numeric(14,2) not null default 0;

create index if not exists idx_products_group on products(item_group);

-- warehouses  <- ERPNext "Warehouse"
alter table warehouses
    add column if not exists warehouse_type text,   -- e.g. Stock / Cold / Transit
    add column if not exists phone          text;
