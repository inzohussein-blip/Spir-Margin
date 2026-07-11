-- =====================================================================
-- Migration 0029 : Material Request
--
-- Ported from ERPNext "Material Request" (Purchase type). An internal request
-- to buy products; it can be turned into a draft purchase invoice.
-- =====================================================================

do $$ begin
    create type mr_status as enum ('draft','ordered','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists material_requests (
    id               uuid primary key default gen_random_uuid(),
    naming_series    text,
    transaction_date date not null default current_date,
    required_by      date,
    status           mr_status not null default 'draft',
    notes            text,
    purchase_id      uuid references purchase_invoices(id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists material_request_items (
    id                  uuid primary key default gen_random_uuid(),
    material_request_id uuid not null references material_requests(id) on delete cascade,
    product_id          uuid not null references products(id) on delete restrict,
    qty                 numeric(14,2) not null check (qty > 0),
    warehouse_id        uuid references warehouses(id) on delete set null,
    created_at          timestamptz not null default now()
);

create index if not exists idx_mritems_mr on material_request_items(material_request_id);

-- Convert to a draft purchase invoice (rate = product default buy price)
create or replace function fn_material_request_to_purchase(p_mr_id uuid)
returns uuid language plpgsql as $$
declare v_status mr_status; v_po uuid; it record; v_buy numeric;
begin
    select status into v_status from material_requests where id = p_mr_id;
    if not found then raise exception 'Material request not found'; end if;
    if v_status = 'ordered' then raise exception 'Material request already ordered'; end if;

    insert into purchase_invoices (posting_date) values (current_date) returning id into v_po;
    for it in select * from material_request_items where material_request_id = p_mr_id loop
        select default_buy_price into v_buy from products where id = it.product_id;
        insert into purchase_items (purchase_id, product_id, qty, rate, warehouse_id)
        values (v_po, it.product_id, it.qty, coalesce(v_buy, 0), it.warehouse_id);
    end loop;

    update material_requests set status = 'ordered', purchase_id = v_po, updated_at = now() where id = p_mr_id;
    return v_po;
end; $$;

alter table material_requests enable row level security;
alter table material_request_items enable row level security;
drop policy if exists "authenticated_all" on material_requests;
drop policy if exists "authenticated_all" on material_request_items;
create policy "authenticated_all" on material_requests for all to authenticated using (true) with check (true);
create policy "authenticated_all" on material_request_items for all to authenticated using (true) with check (true);
