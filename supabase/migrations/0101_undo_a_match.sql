-- =====================================================================
-- Migration 0101 : Undoing a match
--
-- The workbench could create allocations but never remove one. The
-- `unreconcile` action existed in the code and no screen called it, and the
-- workbench lists only UNRECONCILED lines — so a line matched to the wrong
-- payment disappeared from view and stayed wrong. With partial allocation
-- (migration 0100) a line can also carry several allocations, and undoing
-- all of them to correct one is not what the user means.
--
-- fn_allocations lists what is currently matched, and fn_unallocate_as
-- removes ONE allocation. The existing trigger recomputes both sides, so
-- the bank line and the payment both reopen for exactly the amount freed.
-- =====================================================================

create or replace function fn_allocations(
    p_account uuid,
    p_from    date default null,
    p_to      date default null
)
returns table (
    alloc_id        uuid,
    txn_id          uuid,
    txn_date        date,
    txn_description text,
    txn_reference   text,
    txn_total       numeric,
    txn_unallocated numeric,
    txn_status      bank_txn_status,
    payment_id      uuid,
    party_name      text,
    payment_type    payment_type,
    payment_reference text,
    allocated       numeric,
    allocated_at    timestamptz
)
language sql stable as $$
    select btp.id, bt.id, bt.date, bt.description, bt.reference_number,
           (bt.deposit + bt.withdrawal), bt.unallocated_amount, bt.status,
           pe.id, pe.party_name, pe.payment_type, pe.reference_no,
           btp.allocated_amount, btp.created_at
      from bank_transaction_payments btp
      join bank_transactions bt on bt.id = btp.bank_transaction_id
      left join payment_entries pe on pe.id = btp.payment_entry_id
     where bt.bank_account_id = p_account
       and (p_from is null or bt.date >= p_from)
       and (p_to   is null or bt.date <= p_to)
     order by btp.created_at desc, btp.id;
$$;

-- Removing one allocation. The actor travels in the same statement, for the
-- same reason the reconcile wrappers take it (migration 0099).
create or replace function fn_unallocate_as(
    p_alloc_id uuid,
    p_actor    text default null
)
returns void
language plpgsql
as $$
begin
    perform set_config('app.actor', coalesce(p_actor, ''), true);
    delete from bank_transaction_payments where id = p_alloc_id;
end $$;
