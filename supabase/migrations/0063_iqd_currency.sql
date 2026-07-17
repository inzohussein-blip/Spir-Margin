-- =====================================================================
-- Migration 0063 : Iraqi Dinar (IQD) + daily USD rate
--
-- Adds a convenience helper for the owner-managed daily USD -> IQD rate and
-- seeds a starting rate (the owner updates it daily from the Currency page).
-- Builds on the existing currency_exchanges table (0024).
-- =====================================================================

-- Today's effective USD -> IQD rate (latest on/before today); 0 if none set.
create or replace function fn_usd_iqd_rate()
returns numeric language sql stable as $$
    select exchange_rate
    from currency_exchanges
    where from_currency = 'USD' and to_currency = 'IQD' and date <= current_date
    order by date desc
    limit 1;
$$;

-- Set / overwrite today's USD -> IQD rate (owner action). Returns the rate.
create or replace function fn_set_usd_iqd_rate(p_rate numeric)
returns numeric language plpgsql as $$
begin
    if p_rate is null or p_rate <= 0 then raise exception 'Rate must be positive'; end if;
    insert into currency_exchanges (date, from_currency, to_currency, exchange_rate, for_buying, for_selling)
    values (current_date, 'USD', 'IQD', p_rate, true, true)
    on conflict (date, from_currency, to_currency)
    do update set exchange_rate = excluded.exchange_rate;
    return p_rate;
end $$;

-- Seed a starting rate so IQD values render out of the box (owner adjusts daily).
insert into currency_exchanges (date, from_currency, to_currency, exchange_rate, for_buying, for_selling)
values (current_date, 'USD', 'IQD', 1310, true, true)
on conflict (date, from_currency, to_currency) do nothing;
