-- =====================================================================
-- Migration 0014 : Price List
--
-- Ported from ERPNext "Price List" — the named list that item_prices.
-- price_list references. Turns that free-text field into a controlled
-- master with currency + buying/selling flags.
-- =====================================================================

create table if not exists price_lists (
    id             uuid primary key default gen_random_uuid(),
    price_list_name text not null unique,
    currency       text not null default 'USD',
    buying         boolean not null default false,
    selling        boolean not null default true,
    enabled        boolean not null default true,
    created_at     timestamptz not null default now()
);

insert into price_lists (price_list_name, selling, buying) values
    ('Standard Selling', true, false),
    ('Standard Buying', false, true)
on conflict (price_list_name) do nothing;

alter table price_lists enable row level security;
drop policy if exists "authenticated_all" on price_lists;
create policy "authenticated_all" on price_lists
    for all to authenticated using (true) with check (true);
