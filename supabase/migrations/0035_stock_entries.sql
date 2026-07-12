-- =====================================================================
-- Migration 0035 : Stock Entry (kit-batch receipt / issue / transfer)
--
-- Ported (lightened) from ERPNext "Stock Entry" (+ detail rows). Covers
-- the three core purposes over kit batches:
--   receipt  -> add qty into a warehouse
--   issue    -> remove qty from a warehouse
--   transfer -> move a batch's location to another warehouse
-- On submit the batch's qty_available / warehouse_id are updated.
-- =====================================================================

do $$ begin
    create type stock_entry_purpose as enum ('receipt','issue','transfer');
exception when duplicate_object then null; end $$;

do $$ begin
    create type stock_entry_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists stock_entries (
    id             uuid primary key default gen_random_uuid(),
    entry_no       text not null unique,
    purpose        stock_entry_purpose not null default 'transfer',
    status         stock_entry_status not null default 'draft',
    posting_date   date not null default current_date,
    from_warehouse uuid references warehouses(id) on delete set null,
    to_warehouse   uuid references warehouses(id) on delete set null,
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_stentry_status on stock_entries(status);
create index if not exists idx_stentry_date on stock_entries(posting_date);

create table if not exists stock_entry_items (
    id         uuid primary key default gen_random_uuid(),
    entry_id   uuid not null references stock_entries(id) on delete cascade,
    batch_id   uuid not null references kit_batches(id) on delete restrict,
    qty        numeric(14,2) not null default 0 check (qty >= 0),
    rate       numeric(14,2) not null default 0,
    created_at timestamptz not null default now()
);

create index if not exists idx_stitems_entry on stock_entry_items(entry_id);

-- Submit a stock entry: apply each row against its batch. Returns the
-- number of rows applied.
create or replace function fn_submit_stock_entry(p_entry_id uuid)
returns integer language plpgsql as $$
declare
    v_entry stock_entries%rowtype;
    v_row   record;
    v_avail numeric(14,2);
    v_count integer := 0;
begin
    select * into v_entry from stock_entries where id = p_entry_id for update;
    if not found then raise exception 'Stock entry % not found', p_entry_id; end if;
    if v_entry.status = 'submitted' then
        raise exception 'Stock entry % already submitted', v_entry.entry_no;
    end if;
    if v_entry.status = 'cancelled' then
        raise exception 'Stock entry % is cancelled', v_entry.entry_no;
    end if;

    for v_row in select * from stock_entry_items where entry_id = p_entry_id loop
        if v_entry.purpose = 'receipt' then
            update kit_batches set
                qty_received  = qty_received + v_row.qty,
                qty_available = qty_available + v_row.qty,
                warehouse_id  = coalesce(v_entry.to_warehouse, warehouse_id),
                updated_at    = now()
            where id = v_row.batch_id;

        elsif v_entry.purpose = 'issue' then
            select qty_available into v_avail from kit_batches where id = v_row.batch_id for update;
            if v_avail < v_row.qty then
                raise exception 'Batch % has only % available, cannot issue %',
                    v_row.batch_id, v_avail, v_row.qty;
            end if;
            update kit_batches set
                qty_available = qty_available - v_row.qty,
                updated_at    = now()
            where id = v_row.batch_id;

        else -- transfer: move the batch's location
            update kit_batches set
                warehouse_id = coalesce(v_entry.to_warehouse, warehouse_id),
                updated_at   = now()
            where id = v_row.batch_id;
        end if;

        v_count := v_count + 1;
    end loop;

    update stock_entries set status = 'submitted', updated_at = now()
    where id = p_entry_id;

    return v_count;
end $$;

do $$
declare t text;
begin
    foreach t in array array['stock_entries','stock_entry_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
