-- =====================================================================
-- Migration 0079 : Close the audit-trail gaps on financial documents
--
-- Migrations 0065 and 0075 attached the immutable audit trigger (fn_audit)
-- to the money-critical document HEADERS (sales invoices, purchase invoices,
-- sales/purchase orders) and the order LINE items. But several money- and
-- stock-critical tables were still untracked, so a change to them left no
-- trace in Monitoring → Change & Deletion Log. Most importantly, a sales
-- invoice's *line items* were not audited even though its header was — so a
-- quantity or rate on a bill could be altered with no record of it.
--
-- This migration attaches the same append-only audit trigger to the
-- remaining documents whose edits and deletions must be traceable:
--   * sales_invoice_items      — what a lab was actually billed (lines)
--   * sales_invoice_payments   — money recorded as received
--   * quotations / _items      — prices offered to a lab
--   * delivery_notes / _items  — stock leaving on a delivery
--   * purchase_items           — purchase-invoice lines (header already audited)
--   * purchase_receipts / _items — stock received against a PO
--   * supplier_quotations / _items — prices offered by a supplier
--
-- fn_audit is fully generic (it snapshots to_jsonb(old/new) and reads the
-- row's `id`), so no per-table wiring is needed. The block is idempotent and
-- guards each table with to_regclass, matching migration 0075.
-- =====================================================================

do $$
declare t text;
begin
    foreach t in array array[
        'sales_invoice_items',
        'sales_invoice_payments',
        'quotations',
        'quotation_items',
        'delivery_notes',
        'delivery_note_items',
        'purchase_items',
        'purchase_receipts',
        'purchase_receipt_items',
        'supplier_quotations',
        'supplier_quotation_items'
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
