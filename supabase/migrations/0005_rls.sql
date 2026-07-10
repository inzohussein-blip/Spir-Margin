-- =====================================================================
-- Migration 0005 : Row Level Security
-- Enable RLS on all tables. Authenticated users get full access
-- (single-tenant internal tool). Tighten per-role later as needed.
-- =====================================================================

do $$
declare t text;
begin
    foreach t in array array[
        'companies','labs','warehouses','products',
        'devices','maintenance_logs','kit_batches',
        'stock_movements','sales'
    ]
    loop
        execute format('alter table %I enable row level security;', t);

        execute format($f$
            drop policy if exists "authenticated_all" on %I;
        $f$, t);

        execute format($f$
            create policy "authenticated_all" on %I
                for all
                to authenticated
                using (true)
                with check (true);
        $f$, t);
    end loop;
end $$;
