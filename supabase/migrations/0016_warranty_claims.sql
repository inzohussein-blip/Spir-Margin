-- =====================================================================
-- Migration 0016 : Warranty Claim
--
-- Ported from ERPNext "Warranty Claim" — a service complaint against a
-- serialized unit (or device) from a lab, with warranty/AMC status and a
-- resolution trail.
-- =====================================================================

do $$ begin
    create type warranty_claim_status as enum ('open','work_in_progress','closed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists warranty_claims (
    id                 uuid primary key default gen_random_uuid(),
    naming_series      text,
    status             warranty_claim_status not null default 'open',
    complaint_date     date not null default current_date,
    serial_number_id   uuid references serial_numbers(id) on delete set null,
    device_id          uuid references devices(id) on delete set null,
    product_id         uuid references products(id) on delete set null,
    lab_id             uuid references labs(id) on delete set null,
    complaint          text,
    warranty_amc_status serial_warranty_status,
    warranty_expiry_date date,
    amc_expiry_date    date,
    complaint_raised_by text,
    contact_mobile     text,
    contact_email      text,
    resolution_date    timestamptz,
    resolved_by        text,
    resolution_details text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index if not exists idx_wc_status on warranty_claims(status);
create index if not exists idx_wc_lab on warranty_claims(lab_id);
create index if not exists idx_wc_serial on warranty_claims(serial_number_id);

-- open claims feed for a support dashboard
create or replace view v_open_warranty_claims as
select
    w.id, w.naming_series, w.complaint_date, w.status,
    w.complaint, w.warranty_amc_status,
    p.name as product_name, l.name as lab_name, s.serial_no
from warranty_claims w
left join products p on p.id = w.product_id
left join labs l on l.id = w.lab_id
left join serial_numbers s on s.id = w.serial_number_id
where w.status in ('open','work_in_progress')
order by w.complaint_date;

alter table warranty_claims enable row level security;
drop policy if exists "authenticated_all" on warranty_claims;
create policy "authenticated_all" on warranty_claims
    for all to authenticated using (true) with check (true);
