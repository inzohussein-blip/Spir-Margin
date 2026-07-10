-- =====================================================================
-- Migration 0008 : Bank reconciliation logic
-- Trigger + RPC functions + views that reproduce the core behaviour of
-- the Frappe Banking "Match & Reconcile" and rule engine.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Keep unallocated_amount consistent on the transaction itself, so a newly
-- imported line starts fully unallocated (= deposit + withdrawal).
-- ---------------------------------------------------------------------
create or replace function trg_init_bank_txn()
returns trigger
language plpgsql
as $$
begin
    new.unallocated_amount :=
        greatest((coalesce(new.deposit,0) + coalesce(new.withdrawal,0))
                 - coalesce(new.allocated_amount,0), 0);
    return new;
end;
$$;

drop trigger if exists t_init_bank_txn on bank_transactions;
create trigger t_init_bank_txn
    before insert or update on bank_transactions
    for each row execute function trg_init_bank_txn();

-- ---------------------------------------------------------------------
-- Keep a bank transaction's allocation totals & status in sync whenever
-- its payment allocations change; flag linked payment entries reconciled.
-- ---------------------------------------------------------------------
create or replace function trg_sync_bank_txn_allocation()
returns trigger
language plpgsql
as $$
declare
    v_txn_id uuid := coalesce(new.bank_transaction_id, old.bank_transaction_id);
    v_amount numeric;
    v_alloc  numeric;
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

    -- reflect reconciled state on the payment entry that changed
    if tg_op = 'DELETE' then
        if old.payment_entry_id is not null then
            update payment_entries
               set is_reconciled = exists (
                     select 1 from bank_transaction_payments
                      where payment_entry_id = old.payment_entry_id),
                   updated_at = now()
             where id = old.payment_entry_id;
        end if;
        return old;
    else
        if new.payment_entry_id is not null then
            update payment_entries
               set is_reconciled = true,
                   clearance_date = coalesce(new.clearance_date, current_date),
                   updated_at = now()
             where id = new.payment_entry_id;
        end if;
        return new;
    end if;
end;
$$;

drop trigger if exists t_sync_alloc on bank_transaction_payments;
create trigger t_sync_alloc
    after insert or update or delete on bank_transaction_payments
    for each row execute function trg_sync_bank_txn_allocation();

-- ---------------------------------------------------------------------
-- fn_reconcile_transaction: allocate an existing payment entry to a bank
-- transaction (the "Match" action). Returns the resulting status.
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
    v_status   bank_txn_status;
begin
    select unallocated_amount into v_unalloc
      from bank_transactions where id = p_txn_id;

    -- default: allocate the whole remaining transaction amount
    v_amount := coalesce(p_amount, v_unalloc);
    if v_amount <= 0 then
        raise exception 'Nothing left to allocate on this transaction';
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

-- ---------------------------------------------------------------------
-- fn_unreconcile_transaction: remove all allocations from a transaction.
-- ---------------------------------------------------------------------
create or replace function fn_unreconcile_transaction(p_txn_id uuid)
returns void
language sql
as $$
    delete from bank_transaction_payments where bank_transaction_id = p_txn_id;
$$;

-- ---------------------------------------------------------------------
-- fn_apply_rules: evaluate active rules against a transaction and set its
-- party + matched rule. Highest-priority matching rule wins.
-- ---------------------------------------------------------------------
create or replace function fn_apply_rules(p_txn_id uuid)
returns uuid
language plpgsql
as $$
declare
    v_txn   bank_transactions%rowtype;
    v_amt   numeric;
    v_kind  rule_txn_type;
    r       record;
    ok      boolean;
    c       record;
begin
    select * into v_txn from bank_transactions where id = p_txn_id;
    if not found then return null; end if;

    v_amt  := v_txn.deposit + v_txn.withdrawal;
    v_kind := case when v_txn.deposit > 0 then 'deposit' else 'withdrawal' end;

    for r in
        select * from bank_transaction_rules
         where is_disabled = false
           and (transaction_type = 'any' or transaction_type = v_kind)
           and (min_amount is null or v_amt >= min_amount)
           and (max_amount is null or v_amt <= max_amount)
         order by priority asc, created_at asc
    loop
        ok := true;
        for c in select * from bank_rule_conditions where rule_id = r.id loop
            declare v_field text;
            begin
                v_field := case c.field
                    when 'reference_number' then coalesce(v_txn.reference_number,'')
                    else coalesce(v_txn.description,'') end;
                if c.operator = 'equals' then
                    ok := ok and (lower(v_field) = lower(c.value));
                elsif c.operator = 'starts_with' then
                    ok := ok and (lower(v_field) like lower(c.value) || '%');
                else -- contains
                    ok := ok and (position(lower(c.value) in lower(v_field)) > 0);
                end if;
            end;
        end loop;

        if ok then
            update bank_transactions
               set matched_rule_id = r.id,
                   party_type      = r.party_type,
                   party_company_id = r.party_company_id,
                   party_lab_id    = r.party_lab_id,
                   updated_at = now()
             where id = p_txn_id;
            return r.id;
        end if;
    end loop;
    return null;
end;
$$;

-- ---------------------------------------------------------------------
-- Views for the reconciliation dashboard
-- ---------------------------------------------------------------------
create or replace view v_bank_rec_summary as
select
    ba.id   as bank_account_id,
    ba.account_name,
    ba.bank,
    ba.currency,
    coalesce(sum(bt.deposit), 0)                                     as total_deposits,
    coalesce(sum(bt.withdrawal), 0)                                  as total_withdrawals,
    coalesce(sum(case when bt.status <> 'reconciled'
                      then bt.unallocated_amount else 0 end), 0)     as unreconciled_amount,
    count(bt.id) filter (where bt.status <> 'reconciled')            as unreconciled_count,
    count(bt.id) filter (where bt.status = 'reconciled')             as reconciled_count
from bank_accounts ba
left join bank_transactions bt on bt.bank_account_id = ba.id
group by ba.id, ba.account_name, ba.bank, ba.currency;

create or replace view v_unreconciled_transactions as
select
    bt.*,
    ba.account_name,
    ba.bank
from bank_transactions bt
join bank_accounts ba on ba.id = bt.bank_account_id
where bt.status <> 'reconciled' and bt.status <> 'cancelled'
order by bt.date desc;
