-- =====================================================================
-- Migration 0044 : Sales Invoice payment ledger
--
-- Records each payment received against a sales invoice (so the invoice
-- detail page can show a real payment history). fn_record_invoice_payment
-- is extended to write a ledger row alongside updating paid_amount.
-- =====================================================================

create table if not exists sales_invoice_payments (
    id         uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references sales_invoices(id) on delete cascade,
    amount     numeric(14,2) not null check (amount > 0),
    paid_on    date not null default current_date,
    note       text,
    created_at timestamptz not null default now()
);

create index if not exists idx_invpay_invoice on sales_invoice_payments(invoice_id);

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

    insert into sales_invoice_payments (invoice_id, amount) values (p_invoice_id, p_amount);

    perform fn_refresh_invoice_status(p_invoice_id);

    return (select outstanding from sales_invoices where id = p_invoice_id);
end $$;

do $$ begin
    execute 'alter table sales_invoice_payments enable row level security';
    execute 'drop policy if exists "authenticated_all" on sales_invoice_payments';
    execute 'create policy "authenticated_all" on sales_invoice_payments for all to authenticated using (true) with check (true)';
end $$;
