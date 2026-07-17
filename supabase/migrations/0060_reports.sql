-- =====================================================================
-- Migration 0060 : Reporting views
--
-- Analytical views powering the /reports section: receivables aging, sales by
-- product, sales by lab, product profitability, and purchase spend by supplier.
-- Mirrors ERPNext's standard financial/stock reports, expressed as SQL views.
-- =====================================================================

-- Accounts Receivable aging — every open invoice bucketed by how overdue it is.
create or replace view v_ar_aging as
select
    si.id,
    si.invoice_no,
    l.name                                                              as lab_name,
    si.posting_date,
    si.due_date,
    si.outstanding,
    greatest(0, current_date - coalesce(si.due_date, si.posting_date))::int as days_overdue,
    case
        when current_date - coalesce(si.due_date, si.posting_date) <= 0  then 'current'
        when current_date - coalesce(si.due_date, si.posting_date) <= 30 then '1-30'
        when current_date - coalesce(si.due_date, si.posting_date) <= 60 then '31-60'
        when current_date - coalesce(si.due_date, si.posting_date) <= 90 then '61-90'
        else '90+'
    end                                                                 as bucket
from sales_invoices si
join labs l on l.id = si.lab_id
where si.outstanding > 0 and si.status <> 'cancelled';

-- Sales by product — quantity and revenue per item, from submitted invoices.
create or replace view v_sales_by_product as
select
    p.id                       as product_id,
    p.item_code,
    p.name                     as product_name,
    p.product_type,
    coalesce(sum(sii.qty), 0)  as qty_sold,
    coalesce(sum(sii.amount), 0) as revenue,
    count(distinct sii.invoice_id) as invoices
from sales_invoice_items sii
join sales_invoices si on si.id = sii.invoice_id and si.status <> 'cancelled'
join products p on p.id = sii.product_id
group by p.id, p.item_code, p.name, p.product_type;

-- Sales by lab (customer) — billed, paid and outstanding per lab.
create or replace view v_sales_by_lab as
select
    l.id                       as lab_id,
    l.name                     as lab_name,
    count(si.id)               as invoices,
    coalesce(sum(si.total_amount), 0) as total_billed,
    coalesce(sum(si.paid_amount), 0)  as total_paid,
    coalesce(sum(si.outstanding), 0)  as outstanding
from sales_invoices si
join labs l on l.id = si.lab_id
where si.status <> 'cancelled'
group by l.id, l.name;

-- Profitability by product — revenue vs cost, from the sales ledger.
create or replace view v_profitability as
select
    p.id                                    as product_id,
    p.item_code,
    p.name                                  as product_name,
    coalesce(sum(s.qty), 0)                 as qty,
    coalesce(sum(s.qty * s.sell_price), 0)  as revenue,
    coalesce(sum(s.qty * s.buy_price), 0)   as cost,
    coalesce(sum(s.qty * (s.sell_price - s.buy_price)), 0) as profit
from sales s
join products p on p.id = s.product_id
group by p.id, p.item_code, p.name;

-- Purchase spend by supplier.
create or replace view v_purchase_by_supplier as
select
    c.id                        as supplier_id,
    coalesce(c.name, '(unassigned)') as supplier_name,
    count(distinct pi.id)       as invoices,
    coalesce(sum(pi.total_amount), 0) as total_spend
from purchase_invoices pi
left join companies c on c.id = pi.supplier_id
where pi.status <> 'cancelled'
group by c.id, c.name;
