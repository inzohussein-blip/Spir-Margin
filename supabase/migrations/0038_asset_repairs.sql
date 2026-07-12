-- =====================================================================
-- Migration 0038 : Asset Repair (device breakdown repair)
--
-- Ported (lightened) from ERPNext "Asset Repair". Records a breakdown
-- repair on a device: failure/completion dates, actions performed, cost
-- and downtime. On completion a maintenance_logs row is written and the
-- device is returned to service (installed if it has a lab, else in_stock).
-- =====================================================================

do $$ begin
    create type asset_repair_status as enum ('pending','completed','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists asset_repairs (
    id                uuid primary key default gen_random_uuid(),
    repair_no         text not null unique,
    device_id         uuid not null references devices(id) on delete restrict,
    status            asset_repair_status not null default 'pending',
    failure_date      date not null default current_date,
    completion_date   date,
    description       text,
    actions_performed text,
    downtime          text,
    repair_cost       numeric(14,2) not null default 0,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_repairs_device on asset_repairs(device_id);
create index if not exists idx_repairs_status on asset_repairs(status);

-- When a repair is raised the device is taken out of service.
create or replace function fn_open_asset_repair() returns trigger
language plpgsql as $$
begin
    update devices set status = 'in_maintenance'::device_status, updated_at = now()
    where id = new.device_id
      and status in ('installed','out_of_order');
    return new;
end $$;

drop trigger if exists trg_open_asset_repair on asset_repairs;
create trigger trg_open_asset_repair
    after insert on asset_repairs
    for each row execute function fn_open_asset_repair();

-- Complete a repair: log it and return the device to service.
create or replace function fn_complete_asset_repair(p_repair_id uuid, p_completion date default current_date)
returns void language plpgsql as $$
declare
    v_rep asset_repairs%rowtype;
    v_dev devices%rowtype;
begin
    select * into v_rep from asset_repairs where id = p_repair_id for update;
    if not found then raise exception 'Asset repair % not found', p_repair_id; end if;
    if v_rep.status = 'completed' then
        raise exception 'Repair % already completed', v_rep.repair_no;
    end if;
    if v_rep.status = 'cancelled' then
        raise exception 'Repair % is cancelled', v_rep.repair_no;
    end if;

    select * into v_dev from devices where id = v_rep.device_id for update;

    insert into maintenance_logs (device_id, performed_on, description, cost)
    values (v_rep.device_id, p_completion,
            coalesce(v_rep.actions_performed, v_rep.description, 'Repair ' || v_rep.repair_no),
            v_rep.repair_cost);

    update asset_repairs set
        status = 'completed', completion_date = p_completion, updated_at = now()
    where id = p_repair_id;

    update devices set
        status = case when v_dev.lab_id is not null then 'installed'::device_status
                      else 'in_stock'::device_status end,
        updated_at = now()
    where id = v_rep.device_id;
end $$;

do $$
declare t text;
begin
    foreach t in array array['asset_repairs']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
