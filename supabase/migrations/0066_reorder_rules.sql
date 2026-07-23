-- =====================================================================
-- Migration 0066 : Reordering rules (ported idea from Odoo)
--
-- When on-hand stock of a product falls below its reorder_level, it should be
-- reordered from its default supplier. v_reorder_suggestions lists what is
-- short; fn_generate_reorder_pos() raises one DRAFT purchase order per supplier
-- for the shortfall — but only for products that are not already sitting on an
-- open PO, so repeated runs never double-order.
-- =====================================================================

-- On-hand per product (from tracked kit batches) vs. its reorder level.
create or replace view v_reorder_suggestions as
with on_hand as (
    select product_id, sum(qty) as qty from v_stock_balance group by product_id
)
select
    p.id                                   as product_id,
    p.item_code,
    p.name                                 as product_name,
    p.reorder_level,
    coalesce(o.qty, 0)                     as on_hand,
    (p.reorder_level - coalesce(o.qty, 0)) as shortfall,
    p.supplier_id,
    c.name                                 as supplier_name,
    p.default_buy_price
from products p
left join on_hand o  on o.product_id = p.id
left join companies c on c.id = p.supplier_id
where p.is_disabled = false
  and p.reorder_level > 0
  and coalesce(o.qty, 0) < p.reorder_level
order by c.name nulls last, p.name;

-- Raise draft POs (one per supplier) for everything currently short that is not
-- already on an open (draft/submitted) PO. Returns the number of POs created.
create or replace function fn_generate_reorder_pos()
returns integer language plpgsql as $$
declare
    v_sup   uuid;
    v_po    uuid;
    v_no    text;
    v_count int := 0;
    v_lines int;
begin
    for v_sup in
        select distinct supplier_id
        from v_reorder_suggestions
        where supplier_id is not null
    loop
        -- how many still-needed lines does this supplier have?
        select count(*) into v_lines
        from v_reorder_suggestions s
        where s.supplier_id = v_sup
          and not exists (
              select 1 from purchase_order_items poi
              join purchase_orders po on po.id = poi.po_id
              where poi.product_id = s.product_id and po.status in ('draft','submitted'));
        if v_lines = 0 then continue; end if;

        v_no := 'PO-RE-' || to_char(now(), 'YYMMDDHH24MISS') || '-' || substr(v_sup::text, 1, 4);
        insert into purchase_orders (po_no, supplier_id, status, notes)
        values (v_no, v_sup, 'draft', 'Auto-generated from reorder rules')
        returning id into v_po;

        insert into purchase_order_items (po_id, product_id, qty, rate)
        select v_po, s.product_id, s.shortfall, s.default_buy_price
        from v_reorder_suggestions s
        where s.supplier_id = v_sup
          and not exists (
              select 1 from purchase_order_items poi
              join purchase_orders po on po.id = poi.po_id
              where poi.product_id = s.product_id and po.status in ('draft','submitted'));

        v_count := v_count + 1;
    end loop;
    return v_count;
end $$;
