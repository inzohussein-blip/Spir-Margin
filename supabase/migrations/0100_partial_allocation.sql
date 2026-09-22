-- =====================================================================
-- Migration 0100 : Partial allocation between payments and bank lines
--
-- Reality in this business is rarely one payment for one bank line: a lab
-- pays 1,000 against an invoice of 1,500, or settles two deliveries with a
-- single transfer. The transaction side already handled this — allocating
-- less than the full amount leaves `unallocated_amount` behind — but the
-- payment side did not: one allocation of any size flipped
-- `payment_entries.is_reconciled` to true, which took the payment out of
-- the open list and stranded whatever was left of it.
--
-- A payment is now reconciled only once it is fully allocated, and
-- fn_open_payments exposes what remains of each one so the workbench can
-- offer it against the next bank line.
-- =====================================================================

create or replace function trg_sync_bank_txn_allocation()
returns trigger
language plpgsql
as $$
declare
    v_txn_id uuid := coalesce(new.bank_transaction_id, old.bank_transaction_id);
    v_pe_id  uuid := coalesce(new.payment_entry_id, old.payment_entry_id);
    v_amount numeric;
    v_alloc  numeric;
    v_pe_amt numeric;
    v_pe_all numeric;
begin
    select (deposit + withdrawal) into v_amount
      from bank_transactions where id = v_txn_id;

    select coalesce(sum(allocated_amount), 0) into v_alloc
      from bank_transaction_payments where bank_transaction_id = v_txn_id;

    update bank_transactions
       set allocated_amount   = v_alloc,
           unallocated_amount  = greatest(v_amount - v_alloc, 0),
           status = case
               when status = 'cancelled' then 'cancelled'::bank_txn_status
               when v_alloc >= v_amount - 0.005 and v_amount > 0 then 'reconciled'::bank_txn_status
               else 'unreconciled'::bank_txn_status
           end,
           updated_at = now()
     where id = v_txn_id;

    -- The payment stays open while any of it is still unallocated, so the
    -- rest of it can be matched against another bank line.
    if v_pe_id is not null then
        select coalesce(paid_amount, 0) + coalesce(received_amount, 0)
          into v_pe_amt
          from payment_entries where id = v_pe_id;

        select coalesce(sum(allocated_amount), 0) into v_pe_all
          from bank_transaction_payments where payment_entry_id = v_pe_id;

        update payment_entries
           set is_reconciled  = (v_pe_amt > 0 and v_pe_all >= v_pe_amt - 0.005),
               clearance_date = case
                   when v_pe_all <= 0 then null
                   else coalesce(clearance_date, new.clearance_date, current_date)
               end,
               updated_at = now()
         where id = v_pe_id;
    end if;

    return coalesce(new, old);
end;
$$;

-- ---------------------------------------------------------------------
-- Payments with something left to allocate, newest first. `remaining` is
-- what the workbench offers against a bank line; a payment allocated in
-- full simply drops out of the list.
-- ---------------------------------------------------------------------
create or replace function fn_open_payments()
returns table (
    id              uuid,
    payment_type    payment_type,
    party_name      text,
    paid_amount     numeric,
    received_amount numeric,
    reference_no    text,
    posting_date    date,
    allocated       numeric,
    remaining       numeric
)
language sql stable as $$
    select pe.id, pe.payment_type, pe.party_name, pe.paid_amount, pe.received_amount,
           pe.reference_no, pe.posting_date,
           coalesce(a.allocated, 0) as allocated,
           (coalesce(pe.paid_amount,0) + coalesce(pe.received_amount,0)) - coalesce(a.allocated, 0) as remaining
      from payment_entries pe
      left join lateral (
          select sum(btp.allocated_amount) as allocated
            from bank_transaction_payments btp
           where btp.payment_entry_id = pe.id
      ) a on true
     where (coalesce(pe.paid_amount,0) + coalesce(pe.received_amount,0)) - coalesce(a.allocated, 0) > 0.005
     order by pe.posting_date desc, pe.id;
$$;

-- ---------------------------------------------------------------------
-- Unreconciled lines that fall BEFORE the window the user is looking at.
-- Without this they are simply invisible, and an old unmatched line is
-- exactly the one that gets forgotten.
-- ---------------------------------------------------------------------
create or replace function fn_older_unreconciled(p_account uuid, p_before date)
returns table (n int, total numeric)
language sql stable as $$
    select count(*)::int as n,
           coalesce(sum(unallocated_amount), 0) as total
      from bank_transactions
     where bank_account_id = p_account
       and status not in ('reconciled','cancelled')
       and p_before is not null
       and date < p_before;
$$;

-- ---------------------------------------------------------------------
-- Allocating more than the payment has left is a data error, not a
-- rounding question: refuse it rather than silently over-allocating.
-- ---------------------------------------------------------------------
create or replace function fn_reconcile_transaction(
    p_txn_id     uuid,
    p_payment_id uuid,
    p_amount     numeric default null
)
returns bank_txn_status
language plpgsql
as $$
declare
    v_amount   numeric;
    v_unalloc  numeric;
    v_pe_left  numeric;
    v_status   bank_txn_status;
begin
    select unallocated_amount into v_unalloc
      from bank_transactions where id = p_txn_id;

    select (coalesce(pe.paid_amount,0) + coalesce(pe.received_amount,0))
           - coalesce((select sum(allocated_amount) from bank_transaction_payments
                        where payment_entry_id = p_payment_id), 0)
      into v_pe_left
      from payment_entries pe where pe.id = p_payment_id;

    -- default: as much as both sides can still take
    v_amount := coalesce(p_amount, least(v_unalloc, coalesce(v_pe_left, v_unalloc)));
    if v_amount <= 0 then
        raise exception 'Nothing left to allocate on this transaction';
    end if;
    if v_pe_left is not null and v_amount > v_pe_left + 0.005 then
        raise exception 'This payment has only % left to allocate', v_pe_left;
    end if;
    if v_amount > v_unalloc + 0.005 then
        raise exception 'This bank line has only % left to allocate', v_unalloc;
    end if;

    insert into bank_transaction_payments
        (bank_transaction_id, payment_entry_id, allocated_amount, reconciliation_type)
    values (p_txn_id, p_payment_id, v_amount, 'matched')
    on conflict (bank_transaction_id, payment_entry_id)
    do update set allocated_amount = bank_transaction_payments.allocated_amount + excluded.allocated_amount;

    select status into v_status from bank_transactions where id = p_txn_id;
    return v_status;
end;
$$;
