-- =====================================================================
-- Migration 0046 : Service Contract / AMC
--
-- Ported (lightened) from ERPNext "Contract" (+ Contract Template). An
-- annual maintenance / service contract for a lab (optionally a specific
-- device): term dates, value, status. v_expiring_contracts feeds the
-- dashboard so contracts nearing their end date surface early.
-- =====================================================================

do $$ begin
    create type contract_status as enum ('unsigned','active','inactive','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists contract_templates (
    id            uuid primary key default gen_random_uuid(),
    title         text not null unique,
    contract_terms text,
    created_at    timestamptz not null default now()
);

create table if not exists contracts (
    id             uuid primary key default gen_random_uuid(),
    contract_no    text not null unique,
    lab_id         uuid references labs(id) on delete set null,
    device_id      uuid references devices(id) on delete set null,
    status         contract_status not null default 'unsigned',
    start_date     date,
    end_date       date,
    contract_value numeric(14,2) not null default 0,
    contract_terms text,
    signee         text,
    signed_on      date,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_contracts_status on contracts(status);
create index if not exists idx_contracts_lab on contracts(lab_id);
create index if not exists idx_contracts_end on contracts(end_date);

-- active contracts ending within the next 60 days
create or replace view v_expiring_contracts as
select c.id, c.contract_no, c.end_date, c.contract_value,
       (c.end_date - current_date) as days_left,
       l.name as lab_name, d.asset_code
from contracts c
left join labs l on l.id = c.lab_id
left join devices d on d.id = c.device_id
where c.status = 'active'
  and c.end_date is not null
  and c.end_date >= current_date
  and c.end_date <= current_date + 60
order by c.end_date;

insert into contract_templates (title, contract_terms) values
    ('Standard AMC', 'Annual maintenance: 2 preventive visits + breakdown support within 48h.')
on conflict (title) do nothing;

do $$
declare t text;
begin
    foreach t in array array['contract_templates','contracts']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
