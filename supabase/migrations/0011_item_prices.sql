-- =====================================================================
-- Migration 0011 : Item Price (price lists)
--
-- Ported from ERPNext "Item Price" DocType. Lets a product carry multiple
-- prices — per price list, optionally per lab (customer) or supplier, with
-- a validity window and buying/selling flags. This lets each lab have its
-- own negotiated selling rate instead of a single product default.
-- =====================================================================

create table if not exists item_prices (
    id            uuid primary key default gen_random_uuid(),
    product_id    uuid not null references products(id) on delete cascade,
    price_list    text not null default 'Standard Selling',
    selling       boolean not null default true,
    buying        boolean not null default false,
    -- optional party scoping (ERPNext customer / supplier)
    lab_id        uuid references labs(id) on delete set null,
    supplier_id   uuid references companies(id) on delete set null,
    rate          numeric(14,2) not null default 0,
    currency      text not null default 'USD',
    uom           text,
    valid_from    date,
    valid_upto    date,
    note          text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists idx_itemprices_product on item_prices(product_id);
create index if not exists idx_itemprices_lab on item_prices(lab_id);
create index if not exists idx_itemprices_list on item_prices(price_list);

-- ---------------------------------------------------------------------
-- fn_effective_price: the price that applies to a product for a given lab
-- on a given date. Preference order:
--   1. a price scoped to that specific lab
--   2. a general (lab-agnostic) price
-- within the validity window, most-recent valid_from wins. Falls back to
-- the product's default_sell_price when no item price matches.
-- ---------------------------------------------------------------------
create or replace function fn_effective_price(
    p_product_id uuid,
    p_lab_id     uuid default null,
    p_date       date default current_date,
    p_selling    boolean default true
)
returns numeric
language sql
stable
as $$
    select coalesce(
        (select ip.rate
           from item_prices ip
          where ip.product_id = p_product_id
            and ip.selling = p_selling
            and (ip.valid_from is null or ip.valid_from <= p_date)
            and (ip.valid_upto is null or ip.valid_upto >= p_date)
            and (ip.lab_id = p_lab_id or ip.lab_id is null)
          order by (ip.lab_id = p_lab_id) desc nulls last,  -- lab-specific first
                   ip.valid_from desc nulls last
          limit 1),
        (select default_sell_price from products where id = p_product_id),
        0
    );
$$;

-- ---------------------------------------------------------------------
-- View: item prices with product + lab names for listing
-- ---------------------------------------------------------------------
create or replace view v_item_prices as
select
    ip.*,
    p.item_code,
    p.name          as product_name,
    l.name          as lab_name,
    c.name          as supplier_name
from item_prices ip
join products p on p.id = ip.product_id
left join labs l on l.id = ip.lab_id
left join companies c on c.id = ip.supplier_id;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table item_prices enable row level security;
drop policy if exists "authenticated_all" on item_prices;
create policy "authenticated_all" on item_prices
    for all to authenticated using (true) with check (true);
