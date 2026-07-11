-- =====================================================================
-- Migration 0023 : Stock Reconciliation
--
-- Ported from ERPNext "Stock Reconciliation". A physical count that sets the
-- actual available quantity of kit batches; posting it adjusts qty_available
-- and records the difference.
-- =====================================================================

do $$ begin
    create type stock_recon_status as enum ('draft','posted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists stock_reconciliations (
    id            uuid primary key default gen_random_uuid(),
    naming_series text,
    posting_date  date not null default current_date,
    status        stock_recon_status not null default 'draft',
    notes         text,
    posted_at     timestamptz,
    created_at    timestamptz not null default now()
);

create table if not exists stock_reconciliation_items (
    id                uuid primary key default gen_random_uuid(),
    reconciliation_id uuid not null references stock_reconciliations(id) on delete cascade,
    kit_batch_id      uuid not null references kit_batches(id) on delete restrict,
    counted_qty       numeric(14,2) not null,
    -- snapshotted current qty at posting time
    previous_qty      numeric(14,2),
    difference        numeric(14,2),
    created_at        timestamptz not null default now()
);

create index if not exists idx_sritems_recon on stock_reconciliation_items(reconciliation_id);

-- Post: set each batch qty_available to the counted qty, record the diff.
create or replace function fn_post_stock_reconciliation(p_recon_id uuid)
returns int language plpgsql as $$
declare v_status stock_recon_status; it record; v_cur numeric; n int := 0;
begin
    select status into v_status from stock_reconciliations where id = p_recon_id;
    if not found then raise exception 'Reconciliation not found'; end if;
    if v_status = 'posted' then raise exception 'Already posted'; end if;

    for it in select * from stock_reconciliation_items where reconciliation_id = p_recon_id loop
        select qty_available into v_cur from kit_batches where id = it.kit_batch_id;
        update stock_reconciliation_items
           set previous_qty = v_cur, difference = it.counted_qty - v_cur
         where id = it.id;
        update kit_batches
           set qty_available = it.counted_qty, updated_at = now()
         where id = it.kit_batch_id;
        n := n + 1;
    end loop;

    update stock_reconciliations set status = 'posted', posted_at = now() where id = p_recon_id;
    return n;
end; $$;

alter table stock_reconciliations enable row level security;
alter table stock_reconciliation_items enable row level security;
drop policy if exists "authenticated_all" on stock_reconciliations;
drop policy if exists "authenticated_all" on stock_reconciliation_items;
create policy "authenticated_all" on stock_reconciliations for all to authenticated using (true) with check (true);
create policy "authenticated_all" on stock_reconciliation_items for all to authenticated using (true) with check (true);
