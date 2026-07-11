-- =====================================================================
-- Migration 0028 : Quotation
--
-- Ported from ERPNext "Quotation" (+ item). A priced quote to a lab that can
-- be converted into a sales order.
-- =====================================================================

do $$ begin
    create type quotation_status as enum ('draft','open','ordered','lost','expired');
exception when duplicate_object then null; end $$;

create table if not exists quotations (
    id               uuid primary key default gen_random_uuid(),
    naming_series    text,
    lab_id           uuid references labs(id) on delete set null,
    party_name       text,
    transaction_date date not null default current_date,
    valid_till       date,
    status           quotation_status not null default 'draft',
    total_amount     numeric(14,2) not null default 0,
    currency         text not null default 'USD',
    notes            text,
    ordered_sales_order_id uuid references sales_orders(id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists quotation_items (
    id           uuid primary key default gen_random_uuid(),
    quotation_id uuid not null references quotations(id) on delete cascade,
    product_id   uuid not null references products(id) on delete restrict,
    qty          numeric(14,2) not null check (qty > 0),
    rate         numeric(14,2) not null default 0,
    amount       numeric(14,2) generated always as (qty * rate) stored,
    created_at   timestamptz not null default now()
);

create index if not exists idx_qitems_q on quotation_items(quotation_id);

create or replace function trg_sync_quotation_total()
returns trigger language plpgsql as $$
declare v_id uuid := coalesce(new.quotation_id, old.quotation_id);
begin
    update quotations set total_amount = coalesce((select sum(amount) from quotation_items where quotation_id = v_id), 0), updated_at = now()
     where id = v_id;
    return coalesce(new, old);
end; $$;

drop trigger if exists t_sync_quotation_total on quotation_items;
create trigger t_sync_quotation_total
    after insert or update or delete on quotation_items
    for each row execute function trg_sync_quotation_total();

-- Convert to a sales order (copies items), links back, marks ordered.
create or replace function fn_quotation_to_sales_order(p_q_id uuid)
returns uuid language plpgsql as $$
declare v_lab uuid; v_status quotation_status; v_so uuid; it record;
begin
    select lab_id, status into v_lab, v_status from quotations where id = p_q_id;
    if not found then raise exception 'Quotation not found'; end if;
    if v_lab is null then raise exception 'Quotation has no lab'; end if;
    if v_status = 'ordered' then raise exception 'Quotation already ordered'; end if;

    insert into sales_orders (lab_id, transaction_date) values (v_lab, current_date) returning id into v_so;
    for it in select * from quotation_items where quotation_id = p_q_id loop
        insert into sales_order_items (sales_order_id, product_id, qty, rate)
        values (v_so, it.product_id, it.qty, it.rate);
    end loop;

    update quotations set status = 'ordered', ordered_sales_order_id = v_so, updated_at = now() where id = p_q_id;
    return v_so;
end; $$;

alter table quotations enable row level security;
alter table quotation_items enable row level security;
drop policy if exists "authenticated_all" on quotations;
drop policy if exists "authenticated_all" on quotation_items;
create policy "authenticated_all" on quotations for all to authenticated using (true) with check (true);
create policy "authenticated_all" on quotation_items for all to authenticated using (true) with check (true);
