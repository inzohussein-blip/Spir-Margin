-- =====================================================================
-- Migration 0015 : Serial No
--
-- Ported from ERPNext "Serial No" — tracks individual serialized units of a
-- product (e.g. spare parts / components) with warranty & lifecycle status,
-- current warehouse or lab, and optional link to a device.
-- =====================================================================

do $$ begin
    create type serial_status as enum ('active','inactive','consumed','delivered','expired');
exception when duplicate_object then null; end $$;

do $$ begin
    create type serial_warranty_status as enum
        ('under_warranty','out_of_warranty','under_amc','out_of_amc');
exception when duplicate_object then null; end $$;

create table if not exists serial_numbers (
    id                   uuid primary key default gen_random_uuid(),
    serial_no            text not null unique,
    product_id           uuid not null references products(id) on delete restrict,
    status               serial_status not null default 'active',
    maintenance_status   serial_warranty_status,
    -- current location: a warehouse (in stock) or a lab (delivered)
    warehouse_id         uuid references warehouses(id) on delete set null,
    lab_id               uuid references labs(id) on delete set null,
    -- optional link to a tracked device this part belongs to
    device_id            uuid references devices(id) on delete set null,
    batch_no             text,
    purchase_rate        numeric(14,2) not null default 0,
    warranty_period_days int,
    warranty_expiry_date date,
    amc_expiry_date      date,
    posting_date         date not null default current_date,
    description          text,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create index if not exists idx_serial_product on serial_numbers(product_id);
create index if not exists idx_serial_status on serial_numbers(status);
create index if not exists idx_serial_lab on serial_numbers(lab_id);

-- Warranty alert view (mirrors the device maintenance-alert idea)
create or replace view v_serial_warranty_alerts as
select
    s.id, s.serial_no, p.name as product_name, l.name as lab_name,
    s.warranty_expiry_date,
    (s.warranty_expiry_date - current_date) as days_until_expiry
from serial_numbers s
join products p on p.id = s.product_id
left join labs l on l.id = s.lab_id
where s.warranty_expiry_date is not null
  and s.status = 'active'
  and s.warranty_expiry_date <= current_date + interval '60 days'
order by s.warranty_expiry_date;

alter table serial_numbers enable row level security;
drop policy if exists "authenticated_all" on serial_numbers;
create policy "authenticated_all" on serial_numbers
    for all to authenticated using (true) with check (true);
