-- =====================================================================
-- Migration 0055 : Payment Request
--
-- Ported (lightened) from ERPNext "Payment Request". Requests payment against
-- a Sales Invoice for a lab. When marked paid it records the payment on the
-- invoice via the existing fn_record_invoice_payment ledger path, so the
-- receivable balance stays in sync.
-- =====================================================================

do $$ begin
    create type payment_request_status as enum ('draft','requested','paid','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists payment_requests (
    id                uuid primary key default gen_random_uuid(),
    request_no        text not null unique,
    invoice_id        uuid not null references sales_invoices(id) on delete cascade,
    lab_id            uuid references labs(id) on delete set null,
    amount            numeric(14,2) not null check (amount > 0),
    mode_of_payment_id uuid references modes_of_payment(id) on delete set null,
    posting_date      date not null default current_date,
    status            payment_request_status not null default 'draft',
    message           text,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_payreq_invoice on payment_requests(invoice_id);
create index if not exists idx_payreq_status on payment_requests(status);

-- Move a draft request to "requested" (i.e. sent to the lab).
create or replace function fn_submit_payment_request(p_request_id uuid)
returns void language plpgsql as $$
declare v_req payment_requests%rowtype;
begin
    select * into v_req from payment_requests where id = p_request_id for update;
    if not found then raise exception 'Payment request % not found', p_request_id; end if;
    if v_req.status <> 'draft' then raise exception 'Payment request % is not a draft', v_req.request_no; end if;
    update payment_requests set status = 'requested', updated_at = now() where id = p_request_id;
end $$;

-- Mark a request paid: record the payment against the invoice and close it.
create or replace function fn_pay_payment_request(p_request_id uuid)
returns numeric language plpgsql as $$
declare v_req payment_requests%rowtype; v_outstanding numeric;
begin
    select * into v_req from payment_requests where id = p_request_id for update;
    if not found then raise exception 'Payment request % not found', p_request_id; end if;
    if v_req.status = 'paid' then raise exception 'Payment request % already paid', v_req.request_no; end if;
    if v_req.status = 'cancelled' then raise exception 'Payment request % is cancelled', v_req.request_no; end if;

    v_outstanding := fn_record_invoice_payment(v_req.invoice_id, v_req.amount);
    update payment_requests set status = 'paid', updated_at = now() where id = p_request_id;
    return v_outstanding;
end $$;

do $$
declare t text;
begin
    foreach t in array array['payment_requests']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
