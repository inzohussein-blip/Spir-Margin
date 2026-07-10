-- =====================================================================
-- Migration 0002 : Devices & kit batches
--
-- ERPNext mapping:
--   Asset              -> devices          (serialised medical devices)
--   Asset Maintenance  -> maintenance_logs
--   Batch              -> kit_batches      (reagent / consumable kits)
-- =====================================================================

do $$ begin
    -- ERPNext Asset.status, trimmed to what a device tracker needs
    create type device_status as enum (
        'in_stock',        -- in our warehouse, not yet placed
        'installed',       -- installed and operating in a lab
        'in_maintenance',
        'out_of_order',
        'retired'
    );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- devices  (ERPNext "Asset": each physical machine we track)
-- ---------------------------------------------------------------------
create table if not exists devices (
    id                uuid primary key default gen_random_uuid(),
    asset_code        text unique not null,          -- ERPNext naming_series ACC-ASS-
    product_id        uuid not null references products(id) on delete restrict,
    serial_no         text,
    status            device_status not null default 'in_stock',
    -- current physical location; null while sitting in a warehouse
    lab_id            uuid references labs(id) on delete set null,
    warehouse_id      uuid references warehouses(id) on delete set null,
    custodian_name    text,
    purchase_date     date,
    purchase_price    numeric(14,2) not null default 0,
    -- maintenance planning (ERPNext maintenance_required / next date)
    maintenance_required boolean not null default false,
    next_maintenance_date date,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_devices_lab on devices(lab_id);
create index if not exists idx_devices_status on devices(status);
create index if not exists idx_devices_next_maint on devices(next_maintenance_date);

-- ---------------------------------------------------------------------
-- maintenance_logs  (ERPNext "Asset Maintenance" + task rows)
-- ---------------------------------------------------------------------
create table if not exists maintenance_logs (
    id            uuid primary key default gen_random_uuid(),
    device_id     uuid not null references devices(id) on delete cascade,
    performed_on  date not null default current_date,
    performed_by  text,
    description   text,
    cost          numeric(14,2) not null default 0,
    next_due_date date,
    created_at    timestamptz not null default now()
);

create index if not exists idx_maint_device on maintenance_logs(device_id);

-- ---------------------------------------------------------------------
-- kit_batches  (ERPNext "Batch": reagent kits with expiry & pricing)
-- ---------------------------------------------------------------------
create table if not exists kit_batches (
    id                uuid primary key default gen_random_uuid(),
    batch_no          text not null,
    product_id        uuid not null references products(id) on delete restrict,
    warehouse_id      uuid references warehouses(id) on delete set null,
    supplier_id       uuid references companies(id) on delete set null,
    manufacturing_date date,
    expiry_date       date,                         -- ERPNext Batch.expiry_date
    qty_received      numeric(14,2) not null default 0,
    qty_available     numeric(14,2) not null default 0,
    -- price we paid the parent company for this batch (per unit)
    buy_price         numeric(14,2) not null default 0,
    -- price we sell to the lab (per unit)
    sell_price        numeric(14,2) not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now(),
    unique (batch_no, product_id)
);

create index if not exists idx_batches_product on kit_batches(product_id);
create index if not exists idx_batches_expiry on kit_batches(expiry_date);
create index if not exists idx_batches_available on kit_batches(qty_available);
