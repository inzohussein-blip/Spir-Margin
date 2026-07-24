-- =====================================================================
-- Migration 0082 : A return can never exceed what was sold
--
-- fn_book_sales_return (0080/0081) booked a credit note with no link to the
-- actual sales, so a lab could be credited for — and stock restocked for —
-- more than it ever bought. That silently invents inventory and reverses
-- revenue that was never booked. This is the money hole the returns feature
-- must not have.
--
-- The `sales` table is this app's authoritative record of what actually left
-- inventory and generated revenue (POS checkout and delivery both insert into
-- it). So each return line is now validated against it: for a (lab, product),
--     returned_now  <=  total_sold(lab,product)  -  already_returned(lab,product)
-- Because the return header and each line are inserted as the loop runs, a
-- product repeated across lines accumulates correctly (the second line sees the
-- first). Over-return raises a clear error and rolls the whole return back.
-- =====================================================================

create or replace function fn_book_sales_return(
    p_request_id uuid,
    p_lab_id uuid,
    p_posting_date text,
    p_reason text,
    p_notes text,
    p_lines text
) returns uuid language plpgsql as $$
declare
    v_id uuid; it jsonb; n int := 0;
    v_pid uuid; v_qty numeric; v_sell numeric; v_buy numeric; v_type text; v_no text;
    v_sold numeric; v_returned numeric; v_name text;
begin
    if p_request_id is not null then
        select id into v_id from sales_returns where client_request_id = p_request_id;
        if found then return v_id; end if;   -- idempotent replay
    end if;
    if p_lab_id is null then raise exception 'Pick a lab'; end if;

    v_no := 'RET-' || to_char(now(), 'YYMM') || '-' || substr(gen_random_uuid()::text, 1, 6);
    insert into sales_returns (return_no, client_request_id, lab_id, posting_date, reason, notes)
    values (v_no, p_request_id, p_lab_id,
            coalesce(nullif(p_posting_date, ''), current_date::text)::date,
            nullif(p_reason, ''), nullif(p_notes, ''))
    returning id into v_id;

    for it in select * from jsonb_array_elements(p_lines::jsonb) loop
        if coalesce(it->>'product_id', '') = '' then continue; end if;
        v_qty := coalesce((it->>'qty')::numeric, 0);
        if v_qty <= 0 then continue; end if;
        v_pid := (it->>'product_id')::uuid;
        v_sell := coalesce((it->>'sell_price')::numeric, 0);
        select product_type, coalesce(default_buy_price, 0) into v_type, v_buy from products where id = v_pid;

        -- Guard: never credit/restock more than the lab actually bought and
        -- still holds un-returned.
        select coalesce(sum(qty), 0) into v_sold
          from sales where lab_id = p_lab_id and product_id = v_pid;
        select coalesce(sum(ri.qty), 0) into v_returned
          from sales_return_items ri
          join sales_returns sr on sr.id = ri.return_id
          where sr.lab_id = p_lab_id and ri.product_id = v_pid and sr.status = 'submitted';
        if v_qty > v_sold - v_returned then
            select name into v_name from products where id = v_pid;
            raise exception 'Cannot return more than sold for %: sold %, already returned %, tried to return %',
                coalesce(v_name, v_pid::text), v_sold, v_returned, v_qty
                using errcode = 'check_violation';
        end if;

        insert into sales_return_items (return_id, product_id, qty, buy_price, sell_price)
        values (v_id, v_pid, v_qty, coalesce(v_buy, 0), v_sell);

        -- Put kit stock back as a dedicated returned-goods batch — one per line.
        if v_type = 'kit' then
            insert into kit_batches (batch_no, product_id, qty_received, qty_available, buy_price, sell_price)
            values (v_no || '-L' || (n + 1), v_pid, v_qty, v_qty, coalesce(v_buy, 0), v_sell);
        end if;
        n := n + 1;
    end loop;

    if n = 0 then raise exception 'Add at least one line'; end if;

    perform fn_post_return_gl(v_id);
    return v_id;
end $$;
