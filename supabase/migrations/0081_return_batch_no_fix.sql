-- =====================================================================
-- Migration 0081 : Fix duplicate batch_no when a return repeats a product
--
-- fn_book_sales_return (0080) derived the returned-goods batch number from the
-- product id (v_no || '-' || substr(product_id,1,4)). If a return listed the
-- SAME kit product on two lines, both lines produced the same batch_no for the
-- same product and hit the unique(batch_no, product_id) constraint, so the whole
-- return failed. Derive the batch number from the LINE index instead, so every
-- restock batch within a return is unique. Behaviour is otherwise identical.
-- =====================================================================

create or replace function fn_book_sales_return(
    p_request_id uuid,
    p_lab_id uuid,
    p_posting_date text,
    p_reason text,
    p_notes text,
    p_lines text
) returns uuid language plpgsql as $$
declare v_id uuid; it jsonb; n int := 0; v_pid uuid; v_qty numeric; v_sell numeric; v_buy numeric; v_type text; v_no text;
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

        insert into sales_return_items (return_id, product_id, qty, buy_price, sell_price)
        values (v_id, v_pid, v_qty, coalesce(v_buy, 0), v_sell);

        -- Put kit stock back as a dedicated returned-goods batch — one batch per
        -- line (line index), so repeating a product across lines can't collide.
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
