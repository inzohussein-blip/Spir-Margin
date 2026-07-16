-- =====================================================================
-- Migration 0057 : Pick List
--
-- Ported (lightened) from ERPNext "Pick List": a warehouse picking sheet that
-- consolidates the items to pick (optionally against a sales order) before a
-- Delivery Note is cut. picked_qty tracks progress per line; completing the
-- pick defaults picked_qty to the requested qty.
-- =====================================================================

do $$ begin
    create type pick_list_purpose as enum ('delivery','material_transfer');
exception when duplicate_object then null; end $$;

do $$ begin
    create type pick_list_status as enum ('draft','open','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists pick_lists (
    id             uuid primary key default gen_random_uuid(),
    pick_no        text not null unique,
    lab_id         uuid references labs(id) on delete set null,
    sales_order_id uuid references sales_orders(id) on delete set null,
    purpose        pick_list_purpose not null default 'delivery',
    posting_date   date not null default current_date,
    status         pick_list_status not null default 'draft',
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_picklist_status on pick_lists(status);

create table if not exists pick_list_items (
    id           uuid primary key default gen_random_uuid(),
    pick_id      uuid not null references pick_lists(id) on delete cascade,
    product_id   uuid not null references products(id) on delete restrict,
    warehouse_id uuid references warehouses(id) on delete set null,
    qty          numeric(14,2) not null check (qty > 0),
    picked_qty   numeric(14,2) not null default 0,
    batch_no     text,
    created_at   timestamptz not null default now()
);

create index if not exists idx_picklistitems_p on pick_list_items(pick_id);

-- Open a draft pick list (draft -> open, i.e. released to the floor).
create or replace function fn_open_pick_list(p_pick_id uuid)
returns void language plpgsql as $$
declare v_pl pick_lists%rowtype;
begin
    select * into v_pl from pick_lists where id = p_pick_id for update;
    if not found then raise exception 'Pick list % not found', p_pick_id; end if;
    if v_pl.status <> 'draft' then raise exception 'Pick list % is not a draft', v_pl.pick_no; end if;
    if not exists (select 1 from pick_list_items where pick_id = p_pick_id) then
        raise exception 'Pick list % has no items', v_pl.pick_no;
    end if;
    update pick_lists set status = 'open', updated_at = now() where id = p_pick_id;
end $$;

-- Complete a pick: any line with no picked_qty defaults to its full qty.
-- Returns the total picked quantity.
create or replace function fn_complete_pick_list(p_pick_id uuid)
returns numeric language plpgsql as $$
declare v_pl pick_lists%rowtype; v_total numeric;
begin
    select * into v_pl from pick_lists where id = p_pick_id for update;
    if not found then raise exception 'Pick list % not found', p_pick_id; end if;
    if v_pl.status = 'completed' then raise exception 'Pick list % already completed', v_pl.pick_no; end if;
    if v_pl.status = 'cancelled' then raise exception 'Pick list % is cancelled', v_pl.pick_no; end if;

    update pick_list_items set picked_qty = qty where pick_id = p_pick_id and picked_qty = 0;
    select coalesce(sum(picked_qty), 0) into v_total from pick_list_items where pick_id = p_pick_id;
    update pick_lists set status = 'completed', updated_at = now() where id = p_pick_id;
    return v_total;
end $$;

do $$
declare t text;
begin
    foreach t in array array['pick_lists','pick_list_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
