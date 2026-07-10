-- =====================================================================
-- Migration 0004 : Dashboard views & business-logic functions
--
-- Implements المرحلة الثالثة (Business Logic):
--   * profit = (sell_price - buy_price) per kit / sale
--   * lab active/inactive automation based on withdrawal movement
-- Exposed as SQL views + RPC functions callable from Next.js server actions.
-- =====================================================================

-- ---------------------------------------------------------------------
-- View: total profit (from sales) — feeds the dashboard KPI
-- ---------------------------------------------------------------------
create or replace view v_profit_summary as
select
    coalesce(sum(profit), 0)                       as total_profit,
    coalesce(sum(sell_price * qty), 0)             as total_revenue,
    coalesce(sum(buy_price * qty), 0)              as total_cost,
    count(*)                                       as sales_count
from sales;

-- Profit per lab (useful for lab detail pages)
create or replace view v_profit_by_lab as
select
    l.id            as lab_id,
    l.name          as lab_name,
    coalesce(sum(s.profit), 0)          as total_profit,
    coalesce(sum(s.sell_price * s.qty), 0) as total_revenue,
    count(s.id)     as sales_count
from labs l
left join sales s on s.lab_id = l.id
group by l.id, l.name;

-- ---------------------------------------------------------------------
-- View: active labs (with basic stats)
-- ---------------------------------------------------------------------
create or replace view v_active_labs as
select
    l.*,
    (select count(*) from devices d where d.lab_id = l.id) as device_count,
    (select coalesce(sum(m.qty),0) from stock_movements m
        where m.lab_id = l.id and m.type = 'withdrawal')  as total_withdrawn
from labs l
where l.status = 'active';

-- ---------------------------------------------------------------------
-- View: devices needing maintenance (ERPNext maintenance alert)
-- ---------------------------------------------------------------------
create or replace view v_maintenance_alerts as
select
    d.id,
    d.asset_code,
    d.serial_no,
    p.name              as product_name,
    l.name              as lab_name,
    d.status,
    d.next_maintenance_date,
    (d.next_maintenance_date - current_date) as days_until_due
from devices d
join products p on p.id = d.product_id
left join labs l on l.id = d.lab_id
where d.status = 'out_of_order'
   or d.status = 'in_maintenance'
   or (d.maintenance_required = true
       and d.next_maintenance_date is not null
       and d.next_maintenance_date <= current_date + interval '30 days')
order by d.next_maintenance_date nulls last;

-- ---------------------------------------------------------------------
-- View: kits near expiry (within 90 days) with stock on hand
-- ---------------------------------------------------------------------
create or replace view v_expiring_kits as
select
    b.id,
    b.batch_no,
    p.name          as product_name,
    w.name          as warehouse_name,
    b.expiry_date,
    b.qty_available,
    (b.expiry_date - current_date) as days_until_expiry
from kit_batches b
join products p on p.id = b.product_id
left join warehouses w on w.id = b.warehouse_id
where b.qty_available > 0
  and b.expiry_date is not null
  and b.expiry_date <= current_date + interval '90 days'
order by b.expiry_date asc;

-- =====================================================================
-- Business-logic functions (callable as Supabase RPC)
-- =====================================================================

-- ---------------------------------------------------------------------
-- fn_kit_margin: profit margin for a single kit batch
--   returns unit margin and total potential margin on available qty
-- ---------------------------------------------------------------------
create or replace function fn_kit_margin(p_batch_id uuid)
returns table (
    batch_no       text,
    unit_margin    numeric,
    margin_pct     numeric,
    potential_margin numeric
)
language sql
stable
as $$
    select
        b.batch_no,
        (b.sell_price - b.buy_price)                         as unit_margin,
        case when b.buy_price > 0
             then round(((b.sell_price - b.buy_price) / b.buy_price) * 100, 2)
             else null end                                   as margin_pct,
        (b.sell_price - b.buy_price) * b.qty_available        as potential_margin
    from kit_batches b
    where b.id = p_batch_id;
$$;

-- ---------------------------------------------------------------------
-- fn_refresh_lab_status: set a lab active/inactive based on withdrawal
--   activity. A lab with no withdrawal in the last `p_days` days
--   (default 60) is marked inactive; otherwise active.
--   Also refreshes labs.last_activity_at.
-- ---------------------------------------------------------------------
create or replace function fn_refresh_lab_status(
    p_lab_id uuid default null,
    p_days   int  default 60
)
returns int
language plpgsql
as $$
declare
    v_updated int;
begin
    with last_move as (
        select lab_id, max(moved_at) as last_at
        from stock_movements
        where type = 'withdrawal'
        group by lab_id
    )
    update labs l
    set last_activity_at = lm.last_at,
        status = case
            when lm.last_at is not null
                 and lm.last_at >= now() - (p_days || ' days')::interval
            then 'active'::lab_status
            else 'inactive'::lab_status
        end,
        updated_at = now()
    from (
        select l2.id, lm2.last_at
        from labs l2
        left join last_move lm2 on lm2.lab_id = l2.id
    ) lm
    where l.id = lm.id
      and (p_lab_id is null or l.id = p_lab_id);

    get diagnostics v_updated = row_count;
    return v_updated;
end;
$$;

-- ---------------------------------------------------------------------
-- Trigger: whenever a withdrawal is recorded, decrement batch stock,
-- stamp the lab's last activity, and (re)activate the lab.
-- ---------------------------------------------------------------------
create or replace function trg_apply_withdrawal()
returns trigger
language plpgsql
as $$
begin
    if new.type = 'withdrawal' then
        update kit_batches
           set qty_available = qty_available - new.qty,
               updated_at = now()
         where id = new.kit_batch_id;

        update labs
           set last_activity_at = new.moved_at,
               status = 'active',
               updated_at = now()
         where id = new.lab_id;
    elsif new.type in ('return', 'transfer_in') then
        update kit_batches
           set qty_available = qty_available + new.qty,
               updated_at = now()
         where id = new.kit_batch_id;
    end if;
    return new;
end;
$$;

drop trigger if exists t_apply_withdrawal on stock_movements;
create trigger t_apply_withdrawal
    after insert on stock_movements
    for each row execute function trg_apply_withdrawal();
