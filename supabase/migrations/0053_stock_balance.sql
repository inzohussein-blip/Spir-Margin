-- =====================================================================
-- Migration 0053 : Stock Balance report
--
-- ERPNext "Stock Balance" report, expressed as a view: on-hand quantity and
-- valuation per product + warehouse, aggregated from kit_batches.
-- =====================================================================

create or replace view v_stock_balance as
select
    p.id            as product_id,
    p.item_code,
    p.name          as product_name,
    p.product_type,
    w.id            as warehouse_id,
    coalesce(w.name, '(unassigned)') as warehouse_name,
    sum(b.qty_available)                       as qty,
    sum(b.qty_available * b.buy_price)         as stock_value,
    count(*)                                   as batches
from kit_batches b
join products p on p.id = b.product_id
left join warehouses w on w.id = b.warehouse_id
where b.qty_available > 0
group by p.id, p.item_code, p.name, p.product_type, w.id, w.name
order by p.name, warehouse_name;
