-- =====================================================================
-- Migration 0018 : Territory & Customer Group
--
-- Ported from ERPNext "Territory" and "Customer Group" — segmentation
-- masters for labs (a lab has a territory and a group). Enables grouping
-- for reporting and default pricing later.
-- =====================================================================

create table if not exists territories (
    id               uuid primary key default gen_random_uuid(),
    name             text not null unique,
    parent_territory text,
    is_group         boolean not null default false,
    manager          text
);

create table if not exists customer_groups (
    id                    uuid primary key default gen_random_uuid(),
    name                  text not null unique,
    parent_customer_group text,
    is_group              boolean not null default false,
    default_price_list    text,
    credit_limit          numeric(14,2)
);

-- attach to labs (a lab is our "customer")
alter table labs
    add column if not exists territory      text,
    add column if not exists customer_group text;

insert into territories (name, is_group) values
    ('All Territories', true), ('Baghdad', false), ('Basra', false),
    ('Erbil', false), ('Mosul', false)
on conflict (name) do nothing;

insert into customer_groups (name, is_group, default_price_list) values
    ('All Customer Groups', true, null),
    ('Government Labs', false, 'Standard Selling'),
    ('Private Labs', false, 'Standard Selling'),
    ('Hospital Labs', false, 'Standard Selling')
on conflict (name) do nothing;

do $$
declare t text;
begin
    foreach t in array array['territories', 'customer_groups']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
