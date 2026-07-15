-- =====================================================================
-- Migration 0054 : Purchase Receipt (goods receipt)
--
-- Ported (lightened) from ERPNext "Purchase Receipt" (+ item rows). Receives
-- goods against a supplier / purchase order into stock. On submit, kit lines
-- create kit_batches (mirrors the purchase-invoice receive path).
-- =====================================================================

do $$ begin
    create type purchase_receipt_status as enum ('draft','received','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists purchase_receipts (
    id            uuid primary key default gen_random_uuid(),
    receipt_no    text not null unique,
    supplier_id   uuid references companies(id) on delete set null,
    purchase_order_id uuid references purchase_orders(id) on delete set null,
    posting_date  date not null default current_date,
    status        purchase_receipt_status not null default 'draft',
    notes         text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists idx_prcpt_status on purchase_receipts(status);

create table if not exists purchase_receipt_items (
    id           uuid primary key default gen_random_uuid(),
    receipt_id   uuid not null references purchase_receipts(id) on delete cascade,
    product_id   uuid not null references products(id) on delete restrict,
    qty          numeric(14,2) not null check (qty > 0),
    rate         numeric(14,2) not null default 0,
    warehouse_id uuid references warehouses(id) on delete set null,
    batch_no     text,
    expiry_date  date,
    created_at   timestamptz not null default now()
);

create index if not exists idx_prcptitems_r on purchase_receipt_items(receipt_id);

-- Submit a receipt: kit lines become kit_batches (received into stock).
-- Returns the number of batches created.
create or replace function fn_submit_purchase_receipt(p_receipt_id uuid)
returns integer language plpgsql as $$
declare
    v_rcpt purchase_receipts%rowtype;
    v_row  record;
    v_prod products%rowtype;
    v_count integer := 0;
begin
    select * into v_rcpt from purchase_receipts where id = p_receipt_id for update;
    if not found then raise exception 'Receipt % not found', p_receipt_id; end if;
    if v_rcpt.status = 'received' then raise exception 'Receipt % already received', v_rcpt.receipt_no; end if;
    if v_rcpt.status = 'cancelled' then raise exception 'Receipt % is cancelled', v_rcpt.receipt_no; end if;

    for v_row in select * from purchase_receipt_items where receipt_id = p_receipt_id loop
        select * into v_prod from products where id = v_row.product_id;
        if v_prod.product_type = 'kit' then
            insert into kit_batches (batch_no, product_id, warehouse_id, supplier_id,
                                     expiry_date, qty_received, qty_available, buy_price)
            values (coalesce(v_row.batch_no, 'PR-' || v_rcpt.receipt_no || '-' || left(v_row.id::text, 8)),
                    v_row.product_id, v_row.warehouse_id, v_rcpt.supplier_id,
                    v_row.expiry_date, v_row.qty, v_row.qty, v_row.rate)
            on conflict (batch_no, product_id) do update
                set qty_received = kit_batches.qty_received + excluded.qty_received,
                    qty_available = kit_batches.qty_available + excluded.qty_available;
            v_count := v_count + 1;
        end if;
    end loop;

    update purchase_receipts set status = 'received', updated_at = now() where id = p_receipt_id;
    return v_count;
end $$;

-- Seed a receipt from a purchase order (copies its lines). Returns receipt id.
create or replace function fn_receipt_from_po(p_po_id uuid, p_receipt_no text)
returns uuid language plpgsql as $$
declare v_po purchase_orders%rowtype; v_r uuid;
begin
    select * into v_po from purchase_orders where id = p_po_id;
    if not found then raise exception 'Purchase order % not found', p_po_id; end if;
    insert into purchase_receipts (receipt_no, supplier_id, purchase_order_id)
    values (p_receipt_no, v_po.supplier_id, p_po_id) returning id into v_r;
    insert into purchase_receipt_items (receipt_id, product_id, qty, rate)
    select v_r, product_id, qty, rate from purchase_order_items where po_id = p_po_id;
    return v_r;
end $$;

do $$
declare t text;
begin
    foreach t in array array['purchase_receipts','purchase_receipt_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
