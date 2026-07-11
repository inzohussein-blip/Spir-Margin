-- =====================================================================
-- Migration 0021 : Opportunity (CRM)
--
-- Ported from ERPNext "Opportunity" — a qualified sales opportunity, from a
-- lead or an existing lab, with an expected amount, stage and probability.
-- Sits between Lead and Sales Order in the pipeline.
-- =====================================================================

do $$ begin
    create type opportunity_status as enum ('open','quotation','converted','lost','closed');
exception when duplicate_object then null; end $$;

create table if not exists opportunities (
    id                 uuid primary key default gen_random_uuid(),
    title              text not null,
    -- source party: a lead or an existing lab
    lead_id            uuid references leads(id) on delete set null,
    lab_id             uuid references labs(id) on delete set null,
    status             opportunity_status not null default 'open',
    opportunity_type   text,
    sales_stage        text default 'Prospecting',
    opportunity_amount numeric(14,2) not null default 0,
    probability        numeric(5,2) not null default 0,   -- percent
    currency           text not null default 'USD',
    expected_closing   date,
    territory          text,
    contact_email      text,
    contact_mobile     text,
    notes              text,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now()
);

create index if not exists idx_opps_status on opportunities(status);

-- weighted pipeline value view (amount * probability)
create or replace view v_pipeline_summary as
select
    coalesce(sum(opportunity_amount) filter (where status = 'open'), 0)             as open_amount,
    coalesce(sum(opportunity_amount * probability / 100) filter (where status = 'open'), 0) as weighted_amount,
    count(*) filter (where status = 'open')                                          as open_count,
    count(*) filter (where status = 'converted')                                     as won_count,
    count(*) filter (where status = 'lost')                                          as lost_count
from opportunities;

alter table opportunities enable row level security;
drop policy if exists "authenticated_all" on opportunities;
create policy "authenticated_all" on opportunities
    for all to authenticated using (true) with check (true);
