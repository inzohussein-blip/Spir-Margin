-- =====================================================================
-- Migration 0001 : Core entities
-- Re-design of ERPNext's Company / Warehouse / Item structures for a
-- lightweight medical-device sales & lab-tracking app on Supabase.
--
-- ERPNext mapping:
--   Company / Supplier            -> companies
--   Location (assets)             -> labs
--   Warehouse (stock)             -> warehouses
--   Item (stock)                  -> products
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
do $$ begin
    create type company_role as enum ('parent', 'supplier', 'customer');
exception when duplicate_object then null; end $$;

do $$ begin
    -- product_type mirrors ERPNext's is_fixed_asset / stock item split
    create type product_type as enum ('device', 'spare_part', 'kit');
exception when duplicate_object then null; end $$;

do $$ begin
    create type lab_status as enum ('active', 'inactive');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- companies  (parent manufacturer we buy from, and lab customers)
-- ---------------------------------------------------------------------
create table if not exists companies (
    id           uuid primary key default gen_random_uuid(),
    name         text not null,
    role         company_role not null default 'supplier',
    email        text,
    phone        text,
    country      text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- labs  (ERPNext "Location" for assets: where devices physically live)
-- ---------------------------------------------------------------------
create table if not exists labs (
    id             uuid primary key default gen_random_uuid(),
    code           text unique not null,
    name           text not null,
    status         lab_status not null default 'active',
    -- geo, mirrors erpnext Location latitude/longitude
    latitude       double precision,
    longitude      double precision,
    address        text,
    city           text,
    contact_name   text,
    phone          text,
    email          text,
    -- last time the lab pulled kits; drives active/inactive automation
    last_activity_at timestamptz,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- warehouses  (ERPNext "Warehouse": our own stores holding stock)
-- ---------------------------------------------------------------------
create table if not exists warehouses (
    id           uuid primary key default gen_random_uuid(),
    name         text not null,
    is_disabled  boolean not null default false,
    city         text,
    address      text,
    created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- products  (ERPNext "Item": devices, spare parts and kits/reagents)
-- ---------------------------------------------------------------------
create table if not exists products (
    id             uuid primary key default gen_random_uuid(),
    item_code      text unique not null,
    name           text not null,
    product_type   product_type not null,
    brand          text,
    uom            text not null default 'Nos',      -- unit of measure
    supplier_id    uuid references companies(id) on delete set null,
    -- ERPNext Item.shelf_life_in_days -> used for expiry defaulting on kits
    shelf_life_in_days int,
    -- default purchase price from the parent company (buying rate)
    default_buy_price  numeric(14,2) not null default 0,
    -- default selling price to labs (standard_rate in ERPNext)
    default_sell_price numeric(14,2) not null default 0,
    description    text,
    is_disabled    boolean not null default false,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_products_type on products(product_type);
create index if not exists idx_products_supplier on products(supplier_id);
