-- =====================================================================
-- Migration 0097 : Find sales requests and authorisations by number
--
-- The two documents added in 0096 are the ones the company writes most, and
-- the one thing anyone knows about a document afterwards is its number —
-- read off a receipt, or off an authorisation someone is holding. Neither
-- was reachable from the search bar, which made the number useless for
-- finding anything.
--
-- The bearer's name is searchable on an authorisation too: at a checkpoint
-- the caller gives a name, not a reference.
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
        -- `status` is an enum; the other branches give text, so the union needs
        -- it spelled out rather than left to type resolution.
        (select 'issue', i.id, i.subject, i.status::text from issues i, q where i.subject ilike q.pat limit p_limit)
        union all
        (select 'sale_request', r.id, r.request_no,
                coalesce(r.customer_name, (select name from labs where id = r.lab_id))
           from sale_requests r, q
          where r.request_no ilike q.pat
             or coalesce(r.customer_name, '') ilike q.pat
          limit p_limit)
        union all
        (select 'transport_authorization', a.id, a.auth_no,
                a.bearer_name || ' — ' || a.from_governorate || ' ← ' || a.to_governorate
           from transport_authorizations a, q
          where a.auth_no ilike q.pat
             or a.bearer_name ilike q.pat
          limit p_limit)
    ) s
$$;
