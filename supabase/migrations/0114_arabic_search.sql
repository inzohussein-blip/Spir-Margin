-- =====================================================================
-- Migration 0114 : Search that forgives Arabic spelling
--
-- The same name is typed several ways: أحمد / احمد / إحمد, مكتبة / مكتبه,
-- الكندي / الكندى, with or without diacritics or a stretched letter (ـ),
-- with Western or Arabic-Indic digits. A search that matched letters
-- exactly missed most of them.
--
-- fn_ar_norm folds a text the way people consider "the same"; searches
-- compare both sides folded. Stored values are never changed. The browser
-- does the same in src/lib/text/arabic.ts, so both agree.
-- =====================================================================

create or replace function fn_ar_norm(p text) returns text
language sql immutable parallel safe as $$
    select lower(
        translate(
            regexp_replace(coalesce(p, ''), '[\u064B-\u065F\u0670\u0640]', '', 'g'),
            'آأإٱةىؤئ٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
            'ااااهيوي01234567890123456789'
        )
    )
$$;

create or replace function fn_global_search(p_q text, p_limit int default 8)
returns table(entity text, record_id uuid, label text, sublabel text)
language sql stable as $$
    with q as (select '%' || fn_ar_norm(p_q) || '%' as pat)
    select * from (
        (select 'lab'::text, l.id, l.name, l.code from labs l, q
          where fn_ar_norm(l.name) like q.pat or fn_ar_norm(l.code) like q.pat limit p_limit)
        union all
        (select 'product', p.id, p.name, p.item_code from products p, q
          where fn_ar_norm(p.name) like q.pat or fn_ar_norm(p.item_code) like q.pat limit p_limit)
        union all
        (select 'company', c.id, c.name, null from companies c, q
          where fn_ar_norm(c.name) like q.pat limit p_limit)
        union all
        (select 'device', d.id, d.asset_code, d.serial_no from devices d, q
          where fn_ar_norm(d.asset_code) like q.pat or fn_ar_norm(d.serial_no) like q.pat limit p_limit)
        union all
        (select 'sales_invoice', si.id, si.invoice_no, null from sales_invoices si, q
          where fn_ar_norm(si.invoice_no) like q.pat limit p_limit)
        union all
        (select 'purchase_order', po.id, po.po_no, null from purchase_orders po, q
          where fn_ar_norm(po.po_no) like q.pat limit p_limit)
        union all
        -- `status` is an enum; the other branches give text, so the union needs
        -- it spelled out rather than left to type resolution.
        (select 'issue', i.id, i.subject, i.status::text from issues i, q
          where fn_ar_norm(i.subject) like q.pat limit p_limit)
        union all
        (select 'sale_request', r.id, r.request_no,
                coalesce(r.customer_name, (select name from labs where id = r.lab_id))
           from sale_requests r, q
          where fn_ar_norm(r.request_no) like q.pat
             or fn_ar_norm(r.customer_name) like q.pat
          limit p_limit)
        union all
        (select 'transport_authorization', a.id, a.auth_no,
                a.bearer_name || ' — ' || a.from_governorate || ' ← ' || a.to_governorate
           from transport_authorizations a, q
          where fn_ar_norm(a.auth_no) like q.pat
             or fn_ar_norm(a.bearer_name) like q.pat
          limit p_limit)
    ) s
$$;
