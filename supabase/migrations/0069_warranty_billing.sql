-- =====================================================================
-- Migration 0069 : Warranty billing party (ported idea from Tryton)
--
-- A warranty/AMC repair is paid by someone: the agent (us — covered under
-- warranty, a cost to the business), the hospital (out-of-warranty, billable),
-- or an insurer (billable to a third party). Recording who bears each claim's
-- charge lets the business see its warranty cost vs. its receivables.
-- =====================================================================

do $$ begin
    create type warranty_bill_party as enum ('agent','hospital','insurance');
exception when duplicate_object then null; end $$;

alter table warranty_claims
    add column if not exists billed_to     warranty_bill_party not null default 'agent',
    add column if not exists charge_amount numeric(14,2) not null default 0,
    add column if not exists insurer_name  text;

-- Totals by who pays: agent charges are cost to us, hospital/insurance are
-- receivables. Only claims that are not cancelled count.
create or replace view v_warranty_billing as
select
    billed_to,
    count(*)                as claims,
    coalesce(sum(charge_amount), 0) as total_charge
from warranty_claims
where status <> 'cancelled'
group by billed_to;
