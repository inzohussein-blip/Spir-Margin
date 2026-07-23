-- =====================================================================
-- Migration 0075 : Audit sales & purchase orders
--
-- Sales orders and purchase orders can now be edited and deleted from the UI,
-- so they must be traceable like the other money-critical documents. Attach
-- the existing immutable audit trigger (fn_audit, migration 0065) to the order
-- headers and their line items, so every edit and deletion shows up in
-- Monitoring → Change & Deletion Log.
-- =====================================================================

do $$
declare t text;
begin
    foreach t in array array[
        'sales_orders','sales_order_items','purchase_orders','purchase_order_items'
    ]
    loop
        if to_regclass('public.'||t) is not null then
            execute format('drop trigger if exists trg_audit on %I', t);
            execute format(
                'create trigger trg_audit after insert or update or delete on %I '
                'for each row execute function fn_audit()', t);
        end if;
    end loop;
end $$;
