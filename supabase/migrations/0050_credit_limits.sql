-- =====================================================================
-- Migration 0050 : Lab credit limit
--
-- Ported (lightened) from ERPNext "Customer Credit Limit". A per-lab credit
-- ceiling; v_lab_credit compares it against the lab's outstanding receivables
-- so labs that are over (or near) their limit can be flagged.
-- =====================================================================

alter table labs add column if not exists credit_limit numeric(14,2) not null default 0;

create or replace view v_lab_credit as
select
    l.id,
    l.code,
    l.name,
    l.credit_limit,
    coalesce((
        select sum(si.outstanding) from sales_invoices si
        where si.lab_id = l.id and si.status <> 'cancelled'
    ), 0) as outstanding,
    case
        when l.credit_limit > 0 and coalesce((
            select sum(si.outstanding) from sales_invoices si
            where si.lab_id = l.id and si.status <> 'cancelled'
        ), 0) > l.credit_limit
        then true else false
    end as over_limit
from labs l
order by l.name;
