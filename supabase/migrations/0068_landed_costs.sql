-- =====================================================================
-- Migration 0068 : Landed cost vouchers (ported idea from Metasfresh)
--
-- Imported goods carry costs beyond the supplier price — freight, customs,
-- clearance. A landed-cost voucher spreads those extras across the kit batches
-- created by a purchase receipt (by value or by quantity), raising each batch's
-- true unit cost so profit margins reflect the REAL cost of goods, not just the
-- invoice price.
-- =====================================================================

do $$ begin
    create type landed_alloc_method as enum ('by_value','by_qty');
exception when duplicate_object then null; end $$;
do $$ begin
    create type landed_cost_status as enum ('draft','applied');
exception when duplicate_object then null; end $$;

create table if not exists landed_cost_vouchers (
    id                uuid primary key default gen_random_uuid(),
    voucher_no        text not null unique,
    receipt_id        uuid not null references purchase_receipts(id) on delete cascade,
    freight           numeric(14,2) not null default 0,
    customs           numeric(14,2) not null default 0,
    clearance         numeric(14,2) not null default 0,
    other             numeric(14,2) not null default 0,
    total_extra       numeric(14,2) generated always as (freight + customs + clearance + other) stored,
    allocation_method landed_alloc_method not null default 'by_value',
    status            landed_cost_status not null default 'draft',
    notes             text,
    created_at        timestamptz not null default now(),
    applied_at        timestamptz
);

create index if not exists idx_landed_receipt on landed_cost_vouchers(receipt_id);

-- Spread the voucher's extra cost across the receipt's kit batches and bump
-- each batch's buy_price by its per-unit share. Idempotent: only a draft
-- voucher against a received receipt is applied, and it flips to 'applied'.
create or replace function fn_apply_landed_cost(p_voucher_id uuid)
returns numeric language plpgsql as $$
declare
    v_v      landed_cost_vouchers%rowtype;
    v_rcpt   purchase_receipts%rowtype;
    v_base   numeric;
    v_row    record;
    v_share  numeric;
    v_batch  text;
begin
    select * into v_v from landed_cost_vouchers where id = p_voucher_id for update;
    if not found then raise exception 'Landed cost voucher % not found', p_voucher_id; end if;
    if v_v.status = 'applied' then raise exception 'Voucher % is already applied', v_v.voucher_no; end if;

    select * into v_rcpt from purchase_receipts where id = v_v.receipt_id;
    if v_rcpt.status <> 'received' then
        raise exception 'Receipt % must be received before landed costs can be applied', v_rcpt.receipt_no;
    end if;
    if v_v.total_extra <= 0 then raise exception 'Voucher % has no extra cost to allocate', v_v.voucher_no; end if;

    -- allocation base over kit items only (those that produced stock batches)
    select sum(case when v_v.allocation_method = 'by_qty' then ri.qty else ri.qty * ri.rate end)
      into v_base
    from purchase_receipt_items ri
    join products p on p.id = ri.product_id
    where ri.receipt_id = v_v.receipt_id and p.product_type = 'kit';

    if coalesce(v_base, 0) = 0 then raise exception 'Receipt % has no stockable items to allocate onto', v_rcpt.receipt_no; end if;

    for v_row in
        select ri.*, (case when v_v.allocation_method = 'by_qty' then ri.qty else ri.qty * ri.rate end) as weight
        from purchase_receipt_items ri
        join products p on p.id = ri.product_id
        where ri.receipt_id = v_v.receipt_id and p.product_type = 'kit'
    loop
        v_share := v_v.total_extra * (v_row.weight / v_base);   -- extra cost for this line
        v_batch := coalesce(v_row.batch_no, 'PR-' || v_rcpt.receipt_no || '-' || left(v_row.id::text, 8));
        update kit_batches
           set buy_price = buy_price + (v_share / nullif(v_row.qty, 0))
         where product_id = v_row.product_id and batch_no = v_batch;
    end loop;

    update landed_cost_vouchers set status = 'applied', applied_at = now() where id = p_voucher_id;
    return v_v.total_extra;
end $$;

alter table landed_cost_vouchers enable row level security;
drop policy if exists "authenticated_all" on landed_cost_vouchers;
create policy "authenticated_all" on landed_cost_vouchers for all to authenticated using (true) with check (true);
