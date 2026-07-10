-- =====================================================================
-- Migration 0010 : Purchasing (Buying)
--
-- Ported from ERPNext Purchase Invoice / Purchase Receipt: record buying
-- products from a supplier (parent company). "Receiving" a purchase turns
-- its lines into stock — kit batches for kits, device records for devices.
-- This is the cost side of the profit equation.
-- =====================================================================

do $$ begin
    create type purchase_status as enum ('draft', 'received', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- purchase_invoices  <- ERPNext Purchase Invoice (header)
-- ---------------------------------------------------------------------
create table if not exists purchase_invoices (
    id            uuid primary key default gen_random_uuid(),
    naming_series text,
    supplier_id   uuid references companies(id) on delete set null,
    posting_date  date not null default current_date,
    reference_no  text,                       -- supplier's invoice no.
    status        purchase_status not null default 'draft',
    total_amount  numeric(14,2) not null default 0,
    is_paid       boolean not null default false,
    notes         text,
    received_at   timestamptz,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists idx_pi_supplier on purchase_invoices(supplier_id);
create index if not exists idx_pi_status on purchase_invoices(status);

-- ---------------------------------------------------------------------
-- purchase_items  <- Purchase Invoice Item (lines)
-- ---------------------------------------------------------------------
create table if not exists purchase_items (
    id                 uuid primary key default gen_random_uuid(),
    purchase_id        uuid not null references purchase_invoices(id) on delete cascade,
    product_id         uuid not null references products(id) on delete restrict,
    qty                numeric(14,2) not null check (qty > 0),
    rate               numeric(14,2) not null default 0,   -- buy price per unit
    amount             numeric(14,2) generated always as (qty * rate) stored,
    -- kit-specific receiving hints
    batch_no           text,
    manufacturing_date date,
    expiry_date        date,
    warehouse_id       uuid references warehouses(id) on delete set null,
    created_at         timestamptz not null default now()
);

create index if not exists idx_puritems_purchase on purchase_items(purchase_id);

-- ---------------------------------------------------------------------
-- Keep the invoice total in sync with its lines
-- ---------------------------------------------------------------------
create or replace function trg_sync_purchase_total()
returns trigger
language plpgsql
as $$
declare
    v_id uuid := coalesce(new.purchase_id, old.purchase_id);
begin
    update purchase_invoices
       set total_amount = coalesce((select sum(amount) from purchase_items where purchase_id = v_id), 0),
           updated_at = now()
     where id = v_id;
    return coalesce(new, old);
end;
$$;

drop trigger if exists t_sync_purchase_total on purchase_items;
create trigger t_sync_purchase_total
    after insert or update or delete on purchase_items
    for each row execute function trg_sync_purchase_total();

-- ---------------------------------------------------------------------
-- fn_receive_purchase: post a purchase into stock.
--   kit    -> create a kit_batch (qty, buy price, expiry)
--   device -> create `qty` device rows (in_stock)
--   spare_part -> recorded only (no stock object in this schema)
-- Idempotent-ish: refuses to receive an already-received purchase.
-- ---------------------------------------------------------------------
create or replace function fn_receive_purchase(p_purchase_id uuid)
returns int
language plpgsql
as $$
declare
    v_status  purchase_status;
    v_supplier uuid;
    it        record;
    i         int;
    v_created int := 0;
    v_sell    numeric;
    v_ptype   product_type;
    v_pname   text;
begin
    select status, supplier_id into v_status, v_supplier
      from purchase_invoices where id = p_purchase_id;
    if not found then raise exception 'Purchase not found'; end if;
    if v_status = 'received' then raise exception 'Purchase already received'; end if;
    if v_status = 'cancelled' then raise exception 'Purchase is cancelled'; end if;

    for it in select * from purchase_items where purchase_id = p_purchase_id loop
        select product_type, default_sell_price, name
          into v_ptype, v_sell, v_pname
          from products where id = it.product_id;

        if v_ptype = 'kit' then
            insert into kit_batches
                (batch_no, product_id, warehouse_id, supplier_id,
                 manufacturing_date, expiry_date, qty_received, qty_available,
                 buy_price, sell_price)
            values
                (coalesce(it.batch_no, 'B-' || upper(substr(md5(random()::text), 1, 6))),
                 it.product_id, it.warehouse_id, v_supplier,
                 it.manufacturing_date, it.expiry_date, it.qty, it.qty,
                 it.rate, coalesce(v_sell, it.rate))
            on conflict (batch_no, product_id) do update
                set qty_received = kit_batches.qty_received + excluded.qty_received,
                    qty_available = kit_batches.qty_available + excluded.qty_available,
                    updated_at = now();
            v_created := v_created + 1;

        elsif v_ptype = 'device' then
            for i in 1 .. floor(it.qty)::int loop
                insert into devices
                    (asset_code, product_id, status, warehouse_id,
                     purchase_date, purchase_price)
                values
                    ('ACC-ASS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8)),
                     it.product_id, 'in_stock', it.warehouse_id,
                     current_date, it.rate);
                v_created := v_created + 1;
            end loop;
        end if;
    end loop;

    update purchase_invoices
       set status = 'received', received_at = now(), updated_at = now()
     where id = p_purchase_id;

    return v_created;
end;
$$;

-- ---------------------------------------------------------------------
-- View: purchase profit context (cost bought per supplier)
-- ---------------------------------------------------------------------
create or replace view v_purchase_summary as
select
    coalesce(sum(total_amount) filter (where status = 'received'), 0) as total_received_cost,
    coalesce(sum(total_amount) filter (where status = 'draft'), 0)    as total_draft_cost,
    count(*) filter (where status = 'received')                       as received_count,
    count(*) filter (where status = 'draft')                          as draft_count
from purchase_invoices;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
    foreach t in array array['purchase_invoices', 'purchase_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
