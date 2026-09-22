-- =====================================================================
-- Migration 0099 : A real reconciliation action log
--
-- The "Action Log" tab of the reconciliation workbench used to live in the
-- browser's localStorage: it was per-browser, per-machine, lost on a cache
-- clear, and invisible to anyone else in the company. Bank allocations are
-- money movements, so the log belongs in the database next to the rest of
-- the audit trail (migration 0065).
--
-- bank_transaction_payments is the allocation link: one row per
-- (transaction, payment). An INSERT is a match, a DELETE is an unmatch, so
-- auditing that one table captures the whole story with no extra writes
-- from the application.
-- =====================================================================

do $$
declare t text;
begin
    foreach t in array array['bank_transaction_payments','payment_entries']
    loop
        if to_regclass('public.'||t) is not null then
            execute format('drop trigger if exists trg_audit on %I', t);
            execute format(
                'create trigger trg_audit after insert or update or delete on %I '
                'for each row execute function fn_audit()', t);
        end if;
    end loop;
end $$;

-- Reading the log back per bank account. audit_log keeps the whole row
-- snapshot, so the account is reachable without joining a possibly deleted
-- transaction; the join is still attempted for a human-readable label.
create or replace function fn_bank_action_log(p_account uuid, p_limit int default 100)
returns table (
    at        timestamptz,
    action    text,
    detail    text,
    actor     text
)
language sql stable as $$
    select
        a.changed_at as at,
        case a.action when 'INSERT' then 'match' else 'unmatch' end as action,
        coalesce(
            nullif(concat_ws(' · ',
                nullif(coalesce(pe.party_name, ''), ''),
                nullif(coalesce(bt.description, bt.reference_number, ''), ''),
                to_char(coalesce(
                    (a.new_data->>'allocated_amount')::numeric,
                    (a.old_data->>'allocated_amount')::numeric, 0), 'FM999999999990.00')
            ), ''),
            'حركة مصرفية'
        ) as detail,
        a.actor
    from audit_log a
    left join bank_transactions bt
           on bt.id = coalesce((a.new_data->>'bank_transaction_id')::uuid,
                               (a.old_data->>'bank_transaction_id')::uuid)
    left join payment_entries pe
           on pe.id = coalesce((a.new_data->>'payment_entry_id')::uuid,
                               (a.old_data->>'payment_entry_id')::uuid)
    where a.table_name = 'bank_transaction_payments'
      and a.action in ('INSERT','DELETE')
      and (p_account is null or bt.bank_account_id = p_account)
    order by a.changed_at desc
    limit greatest(coalesce(p_limit, 100), 1);
$$;


-- ---------------------------------------------------------------------
-- Recording WHO matched or unmatched.
--
-- The audit trigger reads the `app.actor` setting. Setting it from the
-- application in a separate round trip would mean two statements that must
-- not be interleaved by another request — the embedded database is a single
-- connection, so that ordering cannot be guaranteed cheaply. These thin
-- wrappers take the actor as an argument and set it INSIDE the same
-- statement, transaction-locally (`set_config(..., true)`), so the value is
-- always the right one and can never leak onto a later request sharing a
-- pooled connection.
-- ---------------------------------------------------------------------
create or replace function fn_reconcile_transaction_as(
    p_txn_id     uuid,
    p_payment_id uuid,
    p_amount     numeric default null,
    p_actor      text    default null
)
returns bank_txn_status
language plpgsql
as $$
begin
    perform set_config('app.actor', coalesce(p_actor, ''), true);
    return fn_reconcile_transaction(p_txn_id, p_payment_id, p_amount);
end $$;

create or replace function fn_unreconcile_transaction_as(
    p_txn_id uuid,
    p_actor  text default null
)
returns void
language plpgsql
as $$
begin
    perform set_config('app.actor', coalesce(p_actor, ''), true);
    perform fn_unreconcile_transaction(p_txn_id);
end $$;

create or replace function fn_apply_rules_as(
    p_txn_id uuid,
    p_actor  text default null
)
returns uuid
language plpgsql
as $$
begin
    perform set_config('app.actor', coalesce(p_actor, ''), true);
    return fn_apply_rules(p_txn_id);
end $$;
