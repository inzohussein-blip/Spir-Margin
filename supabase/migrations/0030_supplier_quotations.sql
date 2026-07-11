-- =====================================================================
-- Migration 0030 : Supplier Quotation
--
-- Ported from ERPNext "Supplier Quotation" (+ item). A supplier's price
-- offer for products; it can be turned into a draft purchase invoice
-- (completing the buying pipeline: Material Request → Supplier Quotation →
-- Purchase).
-- =====================================================================

do $$ begin
    create type sq_status as enum ('draft','submitted','ordered','cancelled','expired');
exception when duplicate_object then null; end $$;

create table if not exists supplier_quotations (
    id               uuid primary key default gen_random_uuid(),
    naming_series    text,
    supplier_id      uuid references companies(id) on delete set null,
    transaction_date date not null default current_date,
    valid_till       date,
    status           sq_status not null default 'draft',
    total_amount     numeric(14,2) not null default 0,
    currency         text not null default 'USD',
    notes            text,
    purchase_id      uuid references purchase_invoices(id) on delete set null,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists supplier_quotation_items (
    id                    uuid primary key default gen_random_uuid(),
    supplier_quotation_id uuid not null references supplier_quotations(id) on delete cascade,
    product_id            uuid not null references products(id) on delete restrict,
    qty                   numeric(14,2) not null check (qty > 0),
    rate                  numeric(14,2) not null default 0,
    amount                numeric(14,2) generated always as (qty * rate) stored,
    created_at            timestamptz not null default now()
);

create index if not exists idx_sqitems_sq on supplier_quotation_items(supplier_quotation_id);

create or replace function trg_sync_sq_total()
returns trigger language plpgsql as $$
declare v_id uuid := coalesce(new.supplier_quotation_id, old.supplier_quotation_id);
begin
    update supplier_quotations set total_amount = coalesce((select sum(amount) from supplier_quotation_items where supplier_quotation_id = v_id), 0), updated_at = now()
     where id = v_id;
    return coalesce(new, old);
end; $$;

drop trigger if exists t_sync_sq_total on supplier_quotation_items;
create trigger t_sync_sq_total
    after insert or update or delete on supplier_quotation_items
    for each row execute function trg_sync_sq_total();

create or replace function fn_supplier_quotation_to_purchase(p_sq_id uuid)
returns uuid language plpgsql as $$
declare v_status sq_status; v_supplier uuid; v_po uuid; it record;
begin
    select status, supplier_id into v_status, v_supplier from supplier_quotations where id = p_sq_id;
    if not found then raise exception 'Supplier quotation not found'; end if;
    if v_status = 'ordered' then raise exception 'Supplier quotation already ordered'; end if;

    insert into purchase_invoices (supplier_id, posting_date) values (v_supplier, current_date) returning id into v_po;
    for it in select * from supplier_quotation_items where supplier_quotation_id = p_sq_id loop
        insert into purchase_items (purchase_id, product_id, qty, rate)
        values (v_po, it.product_id, it.qty, it.rate);
    end loop;

    update supplier_quotations set status = 'ordered', purchase_id = v_po, updated_at = now() where id = p_sq_id;
    return v_po;
end; $$;

alter table supplier_quotations enable row level security;
alter table supplier_quotation_items enable row level security;
drop policy if exists "authenticated_all" on supplier_quotations;
drop policy if exists "authenticated_all" on supplier_quotation_items;
create policy "authenticated_all" on supplier_quotations for all to authenticated using (true) with check (true);
create policy "authenticated_all" on supplier_quotation_items for all to authenticated using (true) with check (true);
