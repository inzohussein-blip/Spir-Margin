-- =====================================================================
-- Migration 0033 : Bill of Materials + Work Order (kit assembly)
--
-- Ported (lightened) from ERPNext "BOM", "BOM Item" and "Work Order".
-- A BOM lists the component products (and qty) consumed to assemble one
-- finished product — here, a reagent kit (كت) built from its parts.
-- A Work Order executes a BOM: on completion it produces a kit_batch of
-- the finished product, priced at the BOM raw-material cost.
-- =====================================================================

do $$ begin
    create type work_order_status as enum
        ('draft','in_process','completed','stopped','cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------- BOMs
create table if not exists boms (
    id                uuid primary key default gen_random_uuid(),
    bom_no            text not null unique,
    product_id        uuid not null references products(id) on delete restrict,
    quantity          numeric(14,2) not null default 1,   -- fg qty this BOM yields
    uom               text,
    is_active         boolean not null default true,
    is_default        boolean not null default false,
    raw_material_cost numeric(14,2) not null default 0,   -- synced from rows
    description       text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_boms_product on boms(product_id);

create table if not exists bom_items (
    id              uuid primary key default gen_random_uuid(),
    bom_id          uuid not null references boms(id) on delete cascade,
    component_id    uuid not null references products(id) on delete restrict,
    qty             numeric(14,3) not null default 1,
    uom             text,
    rate            numeric(14,2) not null default 0,
    amount          numeric(14,2) generated always as (qty * rate) stored,
    source_warehouse uuid references warehouses(id) on delete set null,
    created_at      timestamptz not null default now()
);

create index if not exists idx_bomitems_bom on bom_items(bom_id);

-- keep boms.raw_material_cost = sum of its rows' amounts
create or replace function fn_sync_bom_cost() returns trigger
language plpgsql as $$
declare v_bom uuid;
begin
    v_bom := coalesce(new.bom_id, old.bom_id);
    update boms set
        raw_material_cost = coalesce((select sum(amount) from bom_items where bom_id = v_bom), 0),
        updated_at = now()
    where id = v_bom;
    return null;
end $$;

drop trigger if exists trg_sync_bom_cost on bom_items;
create trigger trg_sync_bom_cost
    after insert or update or delete on bom_items
    for each row execute function fn_sync_bom_cost();

-- ---------------------------------------------------------- Work Orders
create table if not exists work_orders (
    id             uuid primary key default gen_random_uuid(),
    wo_no          text not null unique,
    status         work_order_status not null default 'draft',
    product_id     uuid not null references products(id) on delete restrict,
    bom_id         uuid references boms(id) on delete set null,
    qty            numeric(14,2) not null default 1,   -- fg qty to produce
    produced_qty   numeric(14,2) not null default 0,
    fg_warehouse   uuid references warehouses(id) on delete set null,
    batch_id       uuid references kit_batches(id) on delete set null,  -- produced batch
    planned_start  date,
    planned_end    date,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_wo_status on work_orders(status);
create index if not exists idx_wo_product on work_orders(product_id);

-- Complete a work order: create a kit_batch of the finished product,
-- priced at the BOM's per-unit raw-material cost. Returns the batch id.
create or replace function fn_complete_work_order(p_wo_id uuid)
returns uuid language plpgsql as $$
declare
    v_wo      work_orders%rowtype;
    v_bom     boms%rowtype;
    v_unit    numeric(14,2) := 0;
    v_batch   uuid;
    v_batchno text;
begin
    select * into v_wo from work_orders where id = p_wo_id for update;
    if not found then raise exception 'Work order % not found', p_wo_id; end if;
    if v_wo.status = 'completed' then
        raise exception 'Work order % already completed', v_wo.wo_no;
    end if;
    if v_wo.status = 'cancelled' then
        raise exception 'Work order % is cancelled', v_wo.wo_no;
    end if;

    if v_wo.bom_id is not null then
        select * into v_bom from boms where id = v_wo.bom_id;
        if found and v_bom.quantity > 0 then
            v_unit := round(v_bom.raw_material_cost / v_bom.quantity, 2);
        end if;
    end if;

    v_batchno := 'WO-' || v_wo.wo_no;

    insert into kit_batches (batch_no, product_id, warehouse_id,
                             manufacturing_date, qty_received, qty_available, buy_price)
    values (v_batchno, v_wo.product_id, v_wo.fg_warehouse,
            current_date, v_wo.qty, v_wo.qty, v_unit)
    on conflict (batch_no, product_id) do update
        set qty_received  = kit_batches.qty_received + excluded.qty_received,
            qty_available = kit_batches.qty_available + excluded.qty_available
    returning id into v_batch;

    update work_orders set
        status       = 'completed',
        produced_qty = v_wo.qty,
        batch_id     = v_batch,
        updated_at   = now()
    where id = p_wo_id;

    return v_batch;
end $$;

-- ------------------------------------------------------------------ RLS
do $$
declare t text;
begin
    foreach t in array array['boms','bom_items','work_orders']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
