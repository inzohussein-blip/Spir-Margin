-- =====================================================================
-- Migration 0037 : Asset Movement (device relocation history)
--
-- Ported (lightened) from ERPNext "Asset Movement" (+ item rows). Records
-- moving one or more devices between labs / warehouses and custodians:
--   issue    -> device goes out to a lab (status installed)
--   receipt  -> device returns to a warehouse (status in_stock)
--   transfer -> device moves lab-to-lab / warehouse-to-warehouse
-- On submit each device's location + custodian are updated and the row's
-- source columns are snapshotted for the audit trail.
-- =====================================================================

do $$ begin
    create type asset_movement_purpose as enum ('issue','receipt','transfer');
exception when duplicate_object then null; end $$;

do $$ begin
    create type asset_movement_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists asset_movements (
    id               uuid primary key default gen_random_uuid(),
    movement_no      text not null unique,
    purpose          asset_movement_purpose not null default 'transfer',
    status           asset_movement_status not null default 'draft',
    transaction_date timestamptz not null default now(),
    notes            text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create index if not exists idx_assetmov_status on asset_movements(status);
create index if not exists idx_assetmov_date on asset_movements(transaction_date);

create table if not exists asset_movement_items (
    id                  uuid primary key default gen_random_uuid(),
    movement_id         uuid not null references asset_movements(id) on delete cascade,
    device_id           uuid not null references devices(id) on delete restrict,
    target_lab_id       uuid references labs(id) on delete set null,
    target_warehouse_id uuid references warehouses(id) on delete set null,
    to_custodian        text,
    -- snapshotted from the device at submit time
    source_lab_id       uuid references labs(id) on delete set null,
    source_warehouse_id uuid references warehouses(id) on delete set null,
    from_custodian      text,
    created_at          timestamptz not null default now()
);

create index if not exists idx_assetmovitems_mov on asset_movement_items(movement_id);
create index if not exists idx_assetmovitems_device on asset_movement_items(device_id);

-- Submit a movement: relocate each device and snapshot where it came from.
-- Returns the number of devices moved.
create or replace function fn_submit_asset_movement(p_movement_id uuid)
returns integer language plpgsql as $$
declare
    v_mov   asset_movements%rowtype;
    v_row   record;
    v_dev   devices%rowtype;
    v_count integer := 0;
begin
    select * into v_mov from asset_movements where id = p_movement_id for update;
    if not found then raise exception 'Asset movement % not found', p_movement_id; end if;
    if v_mov.status = 'submitted' then
        raise exception 'Asset movement % already submitted', v_mov.movement_no;
    end if;
    if v_mov.status = 'cancelled' then
        raise exception 'Asset movement % is cancelled', v_mov.movement_no;
    end if;

    for v_row in select * from asset_movement_items where movement_id = p_movement_id loop
        select * into v_dev from devices where id = v_row.device_id for update;

        -- snapshot source for the audit trail
        update asset_movement_items set
            source_lab_id       = v_dev.lab_id,
            source_warehouse_id = v_dev.warehouse_id,
            from_custodian      = v_dev.custodian_name
        where id = v_row.id;

        update devices set
            lab_id         = v_row.target_lab_id,
            warehouse_id   = v_row.target_warehouse_id,
            custodian_name = coalesce(v_row.to_custodian, custodian_name),
            status = case
                when v_row.target_lab_id is not null then 'installed'::device_status
                when v_row.target_warehouse_id is not null then 'in_stock'::device_status
                else status
            end,
            updated_at = now()
        where id = v_row.device_id;

        v_count := v_count + 1;
    end loop;

    update asset_movements set status = 'submitted', updated_at = now()
    where id = p_movement_id;

    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['asset_movements','asset_movement_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
