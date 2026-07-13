-- =====================================================================
-- Migration 0047 : Request for Quotation (multi-supplier)
--
-- Ported (lightened) from ERPNext "Request for Quotation" (+ item & supplier
-- rows). Ask several suppliers to quote the same set of products; each
-- supplier's response becomes a draft Supplier Quotation carrying the RFQ
-- item lines (via fn_rfq_to_supplier_quotation).
-- =====================================================================

do $$ begin
    create type rfq_status as enum ('draft','submitted','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
    create type rfq_quote_status as enum ('pending','received');
exception when duplicate_object then null; end $$;

create table if not exists rfqs (
    id               uuid primary key default gen_random_uuid(),
    rfq_no           text not null unique,
    transaction_date date not null default current_date,
    schedule_date    date,
    status           rfq_status not null default 'draft',
    message          text,
    terms            text,
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);

create table if not exists rfq_items (
    id         uuid primary key default gen_random_uuid(),
    rfq_id     uuid not null references rfqs(id) on delete cascade,
    product_id uuid not null references products(id) on delete restrict,
    qty        numeric(14,2) not null default 1,
    uom        text,
    created_at timestamptz not null default now()
);

create index if not exists idx_rfqitems_rfq on rfq_items(rfq_id);

create table if not exists rfq_suppliers (
    id                    uuid primary key default gen_random_uuid(),
    rfq_id                uuid not null references rfqs(id) on delete cascade,
    supplier_id           uuid not null references companies(id) on delete restrict,
    quote_status          rfq_quote_status not null default 'pending',
    supplier_quotation_id uuid references supplier_quotations(id) on delete set null,
    created_at            timestamptz not null default now(),
    unique (rfq_id, supplier_id)
);

create index if not exists idx_rfqsuppliers_rfq on rfq_suppliers(rfq_id);

create or replace function fn_submit_rfq(p_rfq_id uuid)
returns void language plpgsql as $$
begin
    update rfqs set status = 'submitted', updated_at = now()
    where id = p_rfq_id and status = 'draft';
end $$;

-- Turn one supplier's line into a draft Supplier Quotation seeded with the
-- RFQ items (rate 0 — to be filled in). Marks that supplier 'received'.
-- Returns the new supplier_quotation id.
create or replace function fn_rfq_to_supplier_quotation(p_rfq_supplier_id uuid, p_quote_no text)
returns uuid language plpgsql as $$
declare v_row rfq_suppliers%rowtype; v_sq uuid;
begin
    select * into v_row from rfq_suppliers where id = p_rfq_supplier_id for update;
    if not found then raise exception 'RFQ supplier % not found', p_rfq_supplier_id; end if;
    if v_row.supplier_quotation_id is not null then
        raise exception 'This supplier already has a quotation';
    end if;

    insert into supplier_quotations (naming_series, supplier_id)
    values (p_quote_no, v_row.supplier_id)
    returning id into v_sq;

    insert into supplier_quotation_items (supplier_quotation_id, product_id, qty, rate)
    select v_sq, product_id, qty, 0 from rfq_items where rfq_id = v_row.rfq_id;

    update rfq_suppliers set quote_status = 'received', supplier_quotation_id = v_sq
    where id = p_rfq_supplier_id;

    return v_sq;
end $$;

do $$
declare t text;
begin
    foreach t in array array['rfqs','rfq_items','rfq_suppliers']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
