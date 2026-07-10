-- =====================================================================
-- Migration 0009 : RLS for banking tables (mirrors 0005)
-- =====================================================================

do $$
declare t text;
begin
    foreach t in array array[
        'bank_accounts','payment_entries','bank_transactions',
        'bank_transaction_payments','bank_transaction_rules',
        'bank_rule_conditions','bank_statement_import_logs'
    ]
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
