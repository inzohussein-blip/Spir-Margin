-- =====================================================================
-- Migration 0056 : Blanket Order
--
-- Ported (lightened) from ERPNext "Blanket Order": a long-term agreement with a
-- lab (selling) or a supplier (purchasing) for agreed quantities/rates of
-- products over a validity window. Individual sales/purchase orders draw down
-- the agreed quantity; ordered_qty tracks consumption per line.
-- =====================================================================

do $$ begin
    create type blanket_order_type as enum ('selling','purchasing');
exception when duplicate_object then null; end $$;

do $$ begin
    create type blanket_order_status as enum ('draft','active','expired','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists blanket_orders (
    id           uuid primary key default gen_random_uuid(),
    order_no     text not null unique,
    order_type   blanket_order_type not null default 'selling',
    lab_id       uuid references labs(id) on delete set null,
    supplier_id  uuid references companies(id) on delete set null,
    from_date    date not null default current_date,
    to_date      date not null default (current_date + 365),
    status       blanket_order_status not null default 'draft',
    notes        text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    check (to_date >= from_date)
);

create index if not exists idx_blanket_status on blanket_orders(status);
create index if not exists idx_blanket_type on blanket_orders(order_type);

create table if not exists blanket_order_items (
    id           uuid primary key default gen_random_uuid(),
    order_id     uuid not null references blanket_orders(id) on delete cascade,
    product_id   uuid not null references products(id) on delete restrict,
    qty          numeric(14,2) not null check (qty > 0),
    rate         numeric(14,2) not null default 0,
    ordered_qty  numeric(14,2) not null default 0,
    remaining_qty numeric(14,2) generated always as (qty - ordered_qty) stored,
    created_at   timestamptz not null default now()
);

create index if not exists idx_blanketitems_o on blanket_order_items(order_id);

-- Activate a draft blanket order (draft -> active).
create or replace function fn_submit_blanket_order(p_order_id uuid)
returns void language plpgsql as $$
declare v_bo blanket_orders%rowtype;
begin
    select * into v_bo from blanket_orders where id = p_order_id for update;
    if not found then raise exception 'Blanket order % not found', p_order_id; end if;
    if v_bo.status <> 'draft' then raise exception 'Blanket order % is not a draft', v_bo.order_no; end if;
    if not exists (select 1 from blanket_order_items where order_id = p_order_id) then
        raise exception 'Blanket order % has no items', v_bo.order_no;
    end if;
    update blanket_orders
       set status = case when current_date > to_date then 'expired'::blanket_order_status
                         else 'active'::blanket_order_status end,
           updated_at = now()
     where id = p_order_id;
end $$;

-- Record a draw-down against a line (an order consumes agreed qty).
create or replace function fn_blanket_order_drawdown(p_item_id uuid, p_qty numeric)
returns numeric language plpgsql as $$
declare v_row blanket_order_items%rowtype;
begin
    select * into v_row from blanket_order_items where id = p_item_id for update;
    if not found then raise exception 'Blanket order line % not found', p_item_id; end if;
    if p_qty <= 0 then raise exception 'Draw-down qty must be positive'; end if;
    if v_row.ordered_qty + p_qty > v_row.qty then
        raise exception 'Draw-down exceeds agreed qty (remaining %)', v_row.qty - v_row.ordered_qty;
    end if;
    update blanket_order_items set ordered_qty = ordered_qty + p_qty where id = p_item_id;
    return v_row.qty - v_row.ordered_qty - p_qty;  -- new remaining
end $$;

do $$
declare t text;
begin
    foreach t in array array['blanket_orders','blanket_order_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
