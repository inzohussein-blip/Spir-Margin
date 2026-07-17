-- =====================================================================
-- Migration 0061 : Global record search
--
-- Backs the awesomebar's "search anything" (like ERPNext's global search):
-- a single function that ILIKE-matches across the main documents and returns
-- a uniform (entity, id, label, sublabel) result set.
-- =====================================================================

create or replace function fn_global_search(p_q text, p_limit int default 8)
returns table(entity text, record_id uuid, label text, sublabel text)
language sql stable as $$
    with q as (select '%' || coalesce(p_q, '') || '%' as pat)
    select * from (
        (select 'lab'::text, l.id, l.name, l.code from labs l, q where l.name ilike q.pat or l.code ilike q.pat limit p_limit)
        union all
        (select 'product', p.id, p.name, p.item_code from products p, q where p.name ilike q.pat or p.item_code ilike q.pat limit p_limit)
        union all
        (select 'company', c.id, c.name, null from companies c, q where c.name ilike q.pat limit p_limit)
        union all
        (select 'device', d.id, d.asset_code, d.serial_no from devices d, q where d.asset_code ilike q.pat or coalesce(d.serial_no,'') ilike q.pat limit p_limit)
        union all
        (select 'sales_invoice', si.id, si.invoice_no, null from sales_invoices si, q where si.invoice_no ilike q.pat limit p_limit)
        union all
        (select 'purchase_order', po.id, po.po_no, null from purchase_orders po, q where po.po_no ilike q.pat limit p_limit)
        union all
        (select 'issue', i.id, i.subject, i.status::text from issues i, q where i.subject ilike q.pat limit p_limit)
    ) hits
    limit (p_limit * 4);
$$;
