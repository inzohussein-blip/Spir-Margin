-- =====================================================================
-- Migration 0024 : Currency Exchange
--
-- Ported from ERPNext "Currency Exchange" — dated FX rates between two
-- currencies, with a conversion helper. Lets USD-denominated amounts be
-- shown/settled in a lab's local currency (e.g. IQD).
-- =====================================================================

create table if not exists currency_exchanges (
    id            uuid primary key default gen_random_uuid(),
    date          date not null default current_date,
    from_currency text not null,
    to_currency   text not null,
    exchange_rate numeric(18,6) not null check (exchange_rate > 0),
    for_buying    boolean not null default true,
    for_selling   boolean not null default true,
    created_at    timestamptz not null default now(),
    unique (date, from_currency, to_currency)
);

create index if not exists idx_fx_pair on currency_exchanges(from_currency, to_currency, date);

-- Latest rate on/before a date for a pair; 1.0 for same currency.
create or replace function fn_exchange_rate(
    p_from text,
    p_to   text,
    p_date date default current_date
)
returns numeric
language sql
stable
as $$
    select case
        when p_from = p_to then 1.0
        else coalesce(
            (select exchange_rate from currency_exchanges
              where from_currency = p_from and to_currency = p_to and date <= p_date
              order by date desc limit 1),
            -- try the inverse pair
            (select 1.0 / exchange_rate from currency_exchanges
              where from_currency = p_to and to_currency = p_from and date <= p_date
              order by date desc limit 1),
            1.0)
    end;
$$;

-- Convert an amount between currencies at the effective rate.
create or replace function fn_convert_amount(
    p_amount numeric,
    p_from   text,
    p_to     text,
    p_date   date default current_date
)
returns numeric
language sql
stable
as $$
    select round(p_amount * fn_exchange_rate(p_from, p_to, p_date), 2);
$$;

insert into currency_exchanges (date, from_currency, to_currency, exchange_rate) values
    (current_date, 'USD', 'IQD', 1310.000000),
    (current_date, 'USD', 'EUR', 0.920000)
on conflict do nothing;

alter table currency_exchanges enable row level security;
drop policy if exists "authenticated_all" on currency_exchanges;
create policy "authenticated_all" on currency_exchanges
    for all to authenticated using (true) with check (true);
