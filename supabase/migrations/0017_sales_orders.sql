-- =====================================================================
-- Migration 0017 : Sales Order
--
-- Ported from ERPNext "Sales Order". A lab's order for products; when
-- delivered it posts sales rows (reusing the existing profit logic:
-- sell = order rate, cost = product default buy price).
-- =====================================================================

do $$ begin
    create type so_status as enum ('draft','confirmed','delivered','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists sales_orders (
    id               uuid primary key default gen_random_uuid(),
    naming_series    text,
    lab_id           uuid not null references labs(id) on delete restrict,
    transaction_date date not null default current_date,
    delivery_date    date,
    status           so_status not null default 'draft',
    total_amount     numeric(14,2) not null default 0,
    currency         text not null default 'USD',
    notes            text,
    delivered_at     timestamptz,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists sales_order_items (
    id             uuid primary key default gen_random_uuid(),
    sales_order_id uuid not null references sales_orders(id) on delete cascade,
    product_id     uuid not null references products(id) on delete restrict,
    qty            numeric(14,2) not null check (qty > 0),
    rate           numeric(14,2) not null default 0,
    amount         numeric(14,2) generated always as (qty * rate) stored,
    created_at     timestamptz not null default now()
);

create index if not exists idx_soitems_order on sales_order_items(sales_order_id);

-- keep the order total in sync
create or replace function trg_sync_so_total()
returns trigger language plpgsql as $$
declare v_id uuid := coalesce(new.sales_order_id, old.sales_order_id);
begin
    update sales_orders
       set total_amount = coalesce((select sum(amount) from sales_order_items where sales_order_id = v_id), 0),
           updated_at = now()
     where id = v_id;
    return coalesce(new, old);
end; $$;

drop trigger if exists t_sync_so_total on sales_order_items;
create trigger t_sync_so_total
    after insert or update or delete on sales_order_items
    for each row execute function trg_sync_so_total();

-- deliver: post sales rows from the order items
create or replace function fn_deliver_sales_order(p_so_id uuid)
returns int language plpgsql as $$
declare
    v_status so_status; v_lab uuid; it record; v_buy numeric; n int := 0;
begin
    select status, lab_id into v_status, v_lab from sales_orders where id = p_so_id;
    if not found then raise exception 'Sales order not found'; end if;
    if v_status = 'delivered' then raise exception 'Sales order already delivered'; end if;
    if v_status = 'cancelled' then raise exception 'Sales order is cancelled'; end if;

    for it in select * from sales_order_items where sales_order_id = p_so_id loop
        select default_buy_price into v_buy from products where id = it.product_id;
        insert into sales (lab_id, product_id, qty, buy_price, sell_price)
        values (v_lab, it.product_id, it.qty, coalesce(v_buy, 0), it.rate);
        n := n + 1;
    end loop;

    update sales_orders set status = 'delivered', delivered_at = now(), updated_at = now()
     where id = p_so_id;
    return n;
end; $$;

alter table sales_orders enable row level security;
alter table sales_order_items enable row level security;
drop policy if exists "authenticated_all" on sales_orders;
drop policy if exists "authenticated_all" on sales_order_items;
create policy "authenticated_all" on sales_orders for all to authenticated using (true) with check (true);
create policy "authenticated_all" on sales_order_items for all to authenticated using (true) with check (true);
