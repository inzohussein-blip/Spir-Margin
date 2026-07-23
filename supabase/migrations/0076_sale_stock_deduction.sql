-- =====================================================================
-- Migration 0076 : Deduct stock on sale + prevent overselling
--
-- Until now a POS sale (fn_pos_checkout) and a sales-order delivery
-- (fn_deliver_sales_order) only booked revenue in `sales` — they never touched
-- inventory, so a kit could be sold past its available quantity (an oversell,
-- and a wrong stock balance).
--
-- fn_consume_product_stock decrements batch stock for KIT products (FIFO, soonest
-- expiry first) and raises if there isn't enough. Devices are serial-tracked and
-- spare parts are untracked, so they are sold without a stock check (unchanged).
--
-- Stock is decremented directly on kit_batches (not via stock_movements) so this
-- does NOT double-count profit — `sales` remains the single revenue source.
-- Both sale paths run in one transaction, so an insufficient-stock error rolls
-- the whole sale back. fn_pos_checkout stays idempotent: a replayed request
-- short-circuits before any stock is touched.
-- =====================================================================

create or replace function fn_consume_product_stock(p_product_id uuid, p_qty numeric)
returns void language plpgsql as $$
declare
    v_type      text;
    v_name      text;
    v_avail     numeric;
    v_remaining numeric := p_qty;
    v_take      numeric;
    b           record;
begin
    select product_type, name into v_type, v_name from products where id = p_product_id;
    -- Only kits carry batch-tracked quantity.
    if v_type is distinct from 'kit' then return; end if;

    select coalesce(sum(qty_available), 0) into v_avail
      from kit_batches where product_id = p_product_id and qty_available > 0;

    if v_avail < p_qty then
        raise exception 'Insufficient stock for %: % available, % needed',
            coalesce(v_name, 'product'), v_avail, p_qty
            using errcode = 'check_violation';
    end if;

    for b in
        select id, qty_available from kit_batches
        where product_id = p_product_id and qty_available > 0
        order by expiry_date nulls last, created_at
        for update
    loop
        exit when v_remaining <= 0;
        v_take := least(b.qty_available, v_remaining);
        update kit_batches set qty_available = qty_available - v_take, updated_at = now() where id = b.id;
        v_remaining := v_remaining - v_take;
    end loop;
end; $$;

-- ---- POS checkout: same as 0073 + a stock check/deduction per line ----------
create or replace function fn_pos_checkout(p_request_id uuid, p_lab_id uuid, p_lines text)
returns table(n_lines int, total_amount numeric)
language plpgsql as $$
declare
    v_result jsonb;
    it        jsonb;
    v_pid     uuid;
    v_qty     numeric;
    v_sell    numeric;
    v_buy     numeric;
    v_disabled boolean;
    v_count   int := 0;
    v_total   numeric := 0;
begin
    if p_request_id is null then raise exception 'Missing request id'; end if;

    select result into v_result from idempotency_keys where key = p_request_id;
    if found then
        return query select (v_result->>'n_lines')::int, (v_result->>'total_amount')::numeric;
        return;
    end if;

    if p_lab_id is null then raise exception 'Select a customer (lab).'; end if;
    perform 1 from labs where id = p_lab_id;
    if not found then raise exception 'Customer not found.'; end if;

    for it in select * from jsonb_array_elements(p_lines::jsonb) loop
        v_pid  := (it->>'product_id')::uuid;
        v_qty  := (it->>'qty')::numeric;
        v_sell := (it->>'sell_price')::numeric;
        if v_pid is null then raise exception 'A product in the cart is invalid.'; end if;
        if v_qty is null or v_qty <= 0 then raise exception 'Quantity must be greater than zero.'; end if;
        if v_sell is null or v_sell < 0 then raise exception 'Sell price cannot be negative.'; end if;

        select default_buy_price, is_disabled into v_buy, v_disabled from products where id = v_pid;
        if not found then raise exception 'A product in the cart no longer exists.'; end if;
        if v_disabled then raise exception 'A product in the cart is disabled.'; end if;

        -- Reserve/deduct inventory (kits only) — raises if there isn't enough.
        perform fn_consume_product_stock(v_pid, v_qty);

        insert into sales (lab_id, product_id, qty, buy_price, sell_price)
        values (p_lab_id, v_pid, v_qty, coalesce(v_buy, 0), v_sell);
        v_count := v_count + 1;
        v_total := v_total + v_qty * v_sell;
    end loop;

    if v_count = 0 then raise exception 'Cart is empty.'; end if;

    v_result := jsonb_build_object('n_lines', v_count, 'total_amount', v_total);
    insert into idempotency_keys (key, result) values (p_request_id, v_result);

    return query select v_count, v_total;
end; $$;

-- ---- Sales-order delivery: same as 0017 + stock check/deduction per line ----
create or replace function fn_deliver_sales_order(p_so_id uuid)
returns int language plpgsql as $$
declare
    v_status so_status; v_lab uuid; it record; v_buy numeric; n int := 0;
begin
    select status, lab_id into v_status, v_lab from sales_orders where id = p_so_id;
    if not found then raise exception 'Sales order not found'; end if;
    if v_status = 'delivered' then raise exception 'Sales order already delivered'; end if;
    if v_status = 'cancelled' then raise exception 'Sales order is cancelled'; end if;

    for it in select * from sales_order_items where sales_order_id = p_so_id loop
        select default_buy_price into v_buy from products where id = it.product_id;
        perform fn_consume_product_stock(it.product_id, it.qty);
        insert into sales (lab_id, product_id, qty, buy_price, sell_price)
        values (v_lab, it.product_id, it.qty, coalesce(v_buy, 0), it.rate);
        n := n + 1;
    end loop;

    update sales_orders set status = 'delivered', delivered_at = now(), updated_at = now()
     where id = p_so_id;
    return n;
end; $$;
