-- =====================================================================
-- Migration 0064 : Recurring AMC billing (ERPNext "Auto Repeat" / Subscription)
--
-- Lets an Annual Maintenance Contract bill itself on a schedule. Each
-- contract gains a billing interval, the service product to charge, and a
-- next-due date. fn_generate_amc_invoices() sweeps every contract whose
-- next_billing_date has arrived and raises a DRAFT sales invoice for the
-- pro-rated period amount, then advances the schedule — the app calls it
-- from the /amc-billing page (there is no background scheduler).
-- =====================================================================

do $$ begin
    create type amc_billing_interval as enum ('none','monthly','quarterly','annually');
exception when duplicate_object then null; end $$;

alter table contracts
    add column if not exists billing_interval  amc_billing_interval not null default 'none',
    add column if not exists service_product_id uuid references products(id) on delete set null,
    add column if not exists next_billing_date  date,
    add column if not exists last_billed_date   date;

-- annual contract_value split across the periods in one year
create or replace function fn_amc_period_amount(p_value numeric, p_interval amc_billing_interval)
returns numeric language sql immutable as $$
    select round(case p_interval
        when 'monthly'   then p_value / 12.0
        when 'quarterly' then p_value / 4.0
        when 'annually'  then p_value
        else 0
    end, 2);
$$;

-- move a date forward by one billing period
create or replace function fn_amc_next_date(p_from date, p_interval amc_billing_interval)
returns date language sql immutable as $$
    select case p_interval
        when 'monthly'   then p_from + interval '1 month'
        when 'quarterly' then p_from + interval '3 months'
        when 'annually'  then p_from + interval '1 year'
        else p_from
    end::date;
$$;

-- contracts that are due to be billed today (or overdue)
create or replace view v_amc_due as
select c.id, c.contract_no, c.lab_id, l.name as lab_name,
       c.billing_interval, c.next_billing_date, c.contract_value,
       fn_amc_period_amount(c.contract_value, c.billing_interval) as period_amount,
       p.item_code as service_item, p.name as service_name,
       (current_date - c.next_billing_date) as days_overdue
from contracts c
join labs l on l.id = c.lab_id
left join products p on p.id = c.service_product_id
where c.status = 'active'
  and c.billing_interval <> 'none'
  and c.service_product_id is not null
  and c.next_billing_date is not null
  and c.next_billing_date <= current_date
order by c.next_billing_date;

-- generate one draft invoice per due contract; returns what was created.
-- Idempotent per period: the invoice_no is keyed to the period date, so a
-- second run in the same period hits the unique constraint and skips.
create or replace function fn_generate_amc_invoices()
returns table(contract_no text, invoice_no text, lab_name text, amount numeric)
language plpgsql as $$
declare
    r        record;
    v_inv    uuid;
    v_no     text;
    v_amount numeric;
begin
    for r in
        select c.*, l.name as lab_name
        from contracts c
        join labs l on l.id = c.lab_id
        where c.status = 'active'
          and c.billing_interval <> 'none'
          and c.service_product_id is not null
          and c.next_billing_date is not null
          and c.next_billing_date <= current_date
        order by c.next_billing_date
    loop
        v_amount := fn_amc_period_amount(r.contract_value, r.billing_interval);
        v_no := 'AMC-' || r.contract_no || '-' || to_char(r.next_billing_date, 'YYYYMMDD');

        -- skip if this period was already billed
        if exists (select 1 from sales_invoices s where s.invoice_no = v_no) then
            continue;
        end if;

        insert into sales_invoices (invoice_no, lab_id, posting_date, due_date, status, notes)
        values (v_no, r.lab_id, r.next_billing_date, r.next_billing_date + 15, 'draft',
                'Auto-generated AMC billing for contract ' || r.contract_no)
        returning id into v_inv;

        insert into sales_invoice_items (invoice_id, product_id, qty, rate)
        values (v_inv, r.service_product_id, 1, v_amount);  -- trigger syncs total

        update contracts
           set last_billed_date = r.next_billing_date,
               next_billing_date = fn_amc_next_date(r.next_billing_date, r.billing_interval),
               updated_at = now()
         where id = r.id;

        contract_no := r.contract_no;
        invoice_no  := v_no;
        lab_name    := r.lab_name;
        amount      := v_amount;
        return next;
    end loop;
end $$;

-- Scalar wrapper so the app can run billing and get a clean invoice count
-- back. The custom PostgREST client calls functions as `select fn() as
-- result` (scalar context), which for the table-returning function above
-- would surface only the first row — so the UI calls this instead.
create or replace function fn_run_amc_billing()
returns integer language plpgsql as $$
declare v_count integer;
begin
    select count(*) into v_count from fn_generate_amc_invoices();
    return v_count;
end $$;
