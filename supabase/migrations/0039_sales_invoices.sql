-- =====================================================================
-- Migration 0039 : Sales Invoice (accounts receivable to labs)
--
-- Ported (lightened) from ERPNext "Sales Invoice" (+ item rows). Bills a
-- lab for products, tracks the outstanding balance and payment status, and
-- can be raised straight from a Sales Order. paid_amount is driven by the
-- record-payment action; outstanding + status follow automatically.
-- =====================================================================

do $$ begin
    create type sales_invoice_status as enum
        ('draft','unpaid','partly_paid','paid','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists sales_invoices (
    id             uuid primary key default gen_random_uuid(),
    invoice_no     text not null unique,
    lab_id         uuid not null references labs(id) on delete restrict,
    sales_order_id uuid references sales_orders(id) on delete set null,
    posting_date   date not null default current_date,
    due_date       date,
    status         sales_invoice_status not null default 'draft',
    total_amount   numeric(14,2) not null default 0,   -- synced from items
    paid_amount    numeric(14,2) not null default 0,
    outstanding    numeric(14,2) generated always as (total_amount - paid_amount) stored,
    currency       text not null default 'USD',
    notes          text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

create index if not exists idx_sinv_lab on sales_invoices(lab_id);
create index if not exists idx_sinv_status on sales_invoices(status);
create index if not exists idx_sinv_date on sales_invoices(posting_date);

create table if not exists sales_invoice_items (
    id          uuid primary key default gen_random_uuid(),
    invoice_id  uuid not null references sales_invoices(id) on delete cascade,
    product_id  uuid not null references products(id) on delete restrict,
    qty         numeric(14,2) not null check (qty > 0),
    rate        numeric(14,2) not null default 0,
    amount      numeric(14,2) generated always as (qty * rate) stored,
    created_at  timestamptz not null default now()
);

create index if not exists idx_sinvitems_inv on sales_invoice_items(invoice_id);

-- keep sales_invoices.total_amount = sum of item amounts, and refresh status
create or replace function fn_sync_invoice_total() returns trigger
language plpgsql as $$
declare v_inv uuid;
begin
    v_inv := coalesce(new.invoice_id, old.invoice_id);
    update sales_invoices set
        total_amount = coalesce((select sum(amount) from sales_invoice_items where invoice_id = v_inv), 0),
        updated_at = now()
    where id = v_inv;
    perform fn_refresh_invoice_status(v_inv);
    return null;
end $$;

drop trigger if exists trg_sync_invoice_total on sales_invoice_items;
create trigger trg_sync_invoice_total
    after insert or update or delete on sales_invoice_items
    for each row execute function fn_sync_invoice_total();

-- derive status from paid vs total (leaves draft/cancelled untouched)
create or replace function fn_refresh_invoice_status(p_invoice_id uuid)
returns void language plpgsql as $$
declare v_inv sales_invoices%rowtype;
begin
    select * into v_inv from sales_invoices where id = p_invoice_id;
    if not found or v_inv.status in ('draft','cancelled') then return; end if;
    update sales_invoices set status = case
        when paid_amount <= 0 then 'unpaid'::sales_invoice_status
        when paid_amount >= total_amount then 'paid'::sales_invoice_status
        else 'partly_paid'::sales_invoice_status
    end
    where id = p_invoice_id;
end $$;

-- submit a draft invoice (draft -> unpaid/paid), then record payments
create or replace function fn_submit_sales_invoice(p_invoice_id uuid)
returns void language plpgsql as $$
begin
    update sales_invoices set status = 'unpaid', updated_at = now()
    where id = p_invoice_id and status = 'draft';
    perform fn_refresh_invoice_status(p_invoice_id);
end $$;

-- record a payment against an invoice; returns the new outstanding
create or replace function fn_record_invoice_payment(p_invoice_id uuid, p_amount numeric)
returns numeric language plpgsql as $$
declare v_inv sales_invoices%rowtype;
begin
    select * into v_inv from sales_invoices where id = p_invoice_id for update;
    if not found then raise exception 'Invoice % not found', p_invoice_id; end if;
    if v_inv.status in ('draft','cancelled') then
        raise exception 'Invoice % is not open for payment', v_inv.invoice_no;
    end if;
    if p_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
    if v_inv.paid_amount + p_amount > v_inv.total_amount then
        raise exception 'Payment exceeds outstanding (% remaining)',
            v_inv.total_amount - v_inv.paid_amount;
    end if;

    update sales_invoices set paid_amount = paid_amount + p_amount, updated_at = now()
    where id = p_invoice_id;
    perform fn_refresh_invoice_status(p_invoice_id);

    return (select outstanding from sales_invoices where id = p_invoice_id);
end $$;

-- build an invoice from a sales order (copies its items). Returns invoice id.
create or replace function fn_invoice_from_sales_order(p_so_id uuid, p_invoice_no text)
returns uuid language plpgsql as $$
declare v_so sales_orders%rowtype; v_inv uuid;
begin
    select * into v_so from sales_orders where id = p_so_id;
    if not found then raise exception 'Sales order % not found', p_so_id; end if;

    insert into sales_invoices (invoice_no, lab_id, sales_order_id, currency)
    values (p_invoice_no, v_so.lab_id, p_so_id, v_so.currency)
    returning id into v_inv;

    insert into sales_invoice_items (invoice_id, product_id, qty, rate)
    select v_inv, product_id, qty, rate from sales_order_items where sales_order_id = p_so_id;

    return v_inv;
end $$;

do $$
declare t text;
begin
    foreach t in array array['sales_invoices','sales_invoice_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
