-- =====================================================================
-- Migration 0052 : Lookup masters
--
-- Ported (lightened) from ERPNext "Terms and Conditions", "Sales Stage",
-- "Opportunity Type", "Opportunity Lost Reason". Small reference lists used
-- by the CRM/selling forms, managed on a single /masters admin page.
-- =====================================================================

create table if not exists terms_and_conditions (
    id         uuid primary key default gen_random_uuid(),
    title      text not null unique,
    terms      text,
    created_at timestamptz not null default now()
);

create table if not exists sales_stages (
    id         uuid primary key default gen_random_uuid(),
    name       text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists opportunity_types (
    id         uuid primary key default gen_random_uuid(),
    name       text not null unique,
    created_at timestamptz not null default now()
);

create table if not exists opportunity_lost_reasons (
    id         uuid primary key default gen_random_uuid(),
    name       text not null unique,
    created_at timestamptz not null default now()
);

insert into sales_stages (name) values
    ('Prospecting'), ('Qualification'), ('Needs Analysis'), ('Proposal'), ('Negotiation'), ('Closed')
on conflict (name) do nothing;

insert into opportunity_types (name) values ('Sales'), ('Maintenance'), ('Support'), ('Installation')
on conflict (name) do nothing;

insert into opportunity_lost_reasons (name) values
    ('Price too high'), ('Chose competitor'), ('No budget'), ('Timing')
on conflict (name) do nothing;

insert into terms_and_conditions (title, terms) values
    ('Standard Sales Terms', 'Payment within 30 days. Goods remain our property until paid in full.')
on conflict (title) do nothing;

do $$
declare t text;
begin
    foreach t in array array['terms_and_conditions','sales_stages','opportunity_types','opportunity_lost_reasons']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
