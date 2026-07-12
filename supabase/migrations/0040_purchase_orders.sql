-- =====================================================================
-- Migration 0040 : Purchase Order (procurement before invoicing)
--
-- Ported (lightened) from ERPNext "Purchase Order" (+ item rows). A PO to a
-- supplier that can be converted into the existing purchase_invoices record
-- (which then receives stock via fn_receive_purchase).
-- =====================================================================

do $$ begin
    create type purchase_order_status as enum
        ('draft','submitted','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists purchase_orders (
    id               uuid primary key default gen_random_uuid(),
    po_no            text not null unique,
    supplier_id      uuid references companies(id) on delete set null,
    transaction_date date not null default current_date,
    required_by      date,
    status           purchase_order_status not null default 'draft',
    total_amount     numeric(14,2) not null default 0,   -- synced from items
    currency         text not null default 'USD',
    notes            text,
    purchase_id      uuid references purchase_invoices(id) on delete set null,  -- once billed
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists idx_po_supplier on purchase_orders(supplier_id);
create index if not exists idx_po_status on purchase_orders(status);

create table if not exists purchase_order_items (
    id         uuid primary key default gen_random_uuid(),
    po_id      uuid not null references purchase_orders(id) on delete cascade,
    product_id uuid not null references products(id) on delete restrict,
    qty        numeric(14,2) not null check (qty > 0),
    rate       numeric(14,2) not null default 0,
    amount     numeric(14,2) generated always as (qty * rate) stored,
    created_at timestamptz not null default now()
);

create index if not exists idx_poitems_po on purchase_order_items(po_id);

-- keep purchase_orders.total_amount = sum of item amounts
create or replace function fn_sync_po_total() returns trigger
language plpgsql as $$
declare v_po uuid;
begin
    v_po := coalesce(new.po_id, old.po_id);
    update purchase_orders set
        total_amount = coalesce((select sum(amount) from purchase_order_items where po_id = v_po), 0),
        updated_at = now()
    where id = v_po;
    return null;
end $$;

drop trigger if exists trg_sync_po_total on purchase_order_items;
create trigger trg_sync_po_total
    after insert or update or delete on purchase_order_items
    for each row execute function fn_sync_po_total();

create or replace function fn_submit_purchase_order(p_po_id uuid)
returns void language plpgsql as $$
begin
    update purchase_orders set status = 'submitted', updated_at = now()
    where id = p_po_id and status = 'draft';
end $$;

-- Convert a PO into a draft purchase invoice (copies its lines). Marks the
-- PO completed and links it. Returns the new purchase invoice id.
create or replace function fn_po_to_purchase_invoice(p_po_id uuid, p_reference text default null)
returns uuid language plpgsql as $$
declare v_po purchase_orders%rowtype; v_pi uuid;
begin
    select * into v_po from purchase_orders where id = p_po_id for update;
    if not found then raise exception 'Purchase order % not found', p_po_id; end if;
    if v_po.status = 'cancelled' then
        raise exception 'Purchase order % is cancelled', v_po.po_no;
    end if;
    if v_po.purchase_id is not null then
        raise exception 'Purchase order % is already billed', v_po.po_no;
    end if;

    insert into purchase_invoices (supplier_id, reference_no, notes)
    values (v_po.supplier_id, p_reference, 'From ' || v_po.po_no)
    returning id into v_pi;

    insert into purchase_items (purchase_id, product_id, qty, rate)
    select v_pi, product_id, qty, rate from purchase_order_items where po_id = p_po_id;

    update purchase_orders set status = 'completed', purchase_id = v_pi, updated_at = now()
    where id = p_po_id;

    return v_pi;
end $$;

do $$
declare t text;
begin
    foreach t in array array['purchase_orders','purchase_order_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
