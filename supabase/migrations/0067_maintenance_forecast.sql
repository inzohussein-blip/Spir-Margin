-- =====================================================================
-- Migration 0067 : Predictive maintenance forecast
--
-- A wider-horizon companion to v_maintenance_alerts: every device that needs
-- maintenance and is overdue or due within the next 90 days, bucketed by
-- urgency and enriched with the date of its last recorded visit at the lab, so
-- a device can be serviced before it fails.
-- =====================================================================

create or replace view v_maintenance_forecast as
with last_visit as (
    select lab_id, max(visit_date) as last_visit_date
    from maintenance_visits
    where status <> 'cancelled'
    group by lab_id
)
select
    d.id,
    d.asset_code,
    d.serial_no,
    p.name                              as product_name,
    l.name                              as lab_name,
    d.status,
    d.next_maintenance_date,
    (d.next_maintenance_date - current_date) as days_until_due,
    case
        when d.next_maintenance_date <  current_date               then 'overdue'
        when d.next_maintenance_date <= current_date + 7           then 'due_this_week'
        when d.next_maintenance_date <= current_date + 30          then 'due_this_month'
        else 'upcoming'
    end                                 as urgency,
    lv.last_visit_date
from devices d
join products p on p.id = d.product_id
left join labs l on l.id = d.lab_id
left join last_visit lv on lv.lab_id = d.lab_id
where d.maintenance_required = true
  and d.next_maintenance_date is not null
  and d.next_maintenance_date <= current_date + 90
order by d.next_maintenance_date;
