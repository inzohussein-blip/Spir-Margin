-- =====================================================================
-- Migration 0012 : Payment Terms
--
-- Ported from ERPNext "Payment Term". A reusable credit term that yields a
-- due date from an invoice date. Wired into purchase_invoices so each
-- purchase gets an automatic due date (what we owe the supplier and when).
-- =====================================================================

do $$ begin
    create type due_date_basis as enum (
        'day_after_invoice',       -- Day(s) after invoice date
        'day_after_month_end',     -- Day(s) after the end of the invoice month
        'month_after_month_end'    -- Month(s) after the end of the invoice month
    );
exception when duplicate_object then null; end $$;

create table if not exists payment_terms (
    id                 uuid primary key default gen_random_uuid(),
    name               text not null unique,
    invoice_portion    numeric(6,2) not null default 100,   -- % of invoice
    mode_of_payment    text,
    due_date_based_on  due_date_basis not null default 'day_after_invoice',
    credit_days        int not null default 0,
    credit_months      int not null default 0,
    description        text,
    created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- fn_due_date: compute a due date from a base date and a term rule
-- ---------------------------------------------------------------------
create or replace function fn_due_date(
    p_base   date,
    p_basis  due_date_basis,
    p_days   int,
    p_months int
)
returns date
language sql
immutable
as $$
    select case p_basis
        when 'day_after_invoice' then
            p_base + p_days
        when 'day_after_month_end' then
            (date_trunc('month', p_base) + interval '1 month - 1 day')::date + p_days
        when 'month_after_month_end' then
            ((date_trunc('month', p_base) + interval '1 month - 1 day')::date
                + (p_months || ' months')::interval)::date
    end;
$$;

-- ---------------------------------------------------------------------
-- Attach payment terms to purchases and auto-fill the due date
-- ---------------------------------------------------------------------
alter table purchase_invoices
    add column if not exists payment_term_id uuid references payment_terms(id) on delete set null,
    add column if not exists due_date date;

create or replace function trg_purchase_due_date()
returns trigger
language plpgsql
as $$
declare t payment_terms%rowtype;
begin
    if new.payment_term_id is not null then
        select * into t from payment_terms where id = new.payment_term_id;
        if found then
            new.due_date := fn_due_date(new.posting_date, t.due_date_based_on, t.credit_days, t.credit_months);
        end if;
    end if;
    return new;
end;
$$;

drop trigger if exists t_purchase_due_date on purchase_invoices;
create trigger t_purchase_due_date
    before insert or update of payment_term_id, posting_date on purchase_invoices
    for each row execute function trg_purchase_due_date();

-- ---------------------------------------------------------------------
-- RLS + seed a few common terms
-- ---------------------------------------------------------------------
alter table payment_terms enable row level security;
drop policy if exists "authenticated_all" on payment_terms;
create policy "authenticated_all" on payment_terms
    for all to authenticated using (true) with check (true);

insert into payment_terms (name, due_date_based_on, credit_days) values
    ('Due on Receipt', 'day_after_invoice', 0),
    ('Net 30',         'day_after_invoice', 30),
    ('Net 60',         'day_after_invoice', 60)
on conflict (name) do nothing;
