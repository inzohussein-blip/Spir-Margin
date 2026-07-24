-- =====================================================================
-- Migration 0078 : Idempotent sales-order creation (offline-safe)
--
-- Sales orders can now be created from the offline outbox and replayed when the
-- network returns, so a replay must never create a duplicate order. Each create
-- carries a client-generated request id; fn_save_sales_order books the order
-- (header + lines) in a single transaction and, on a replay with the same id,
-- just returns the existing order id and changes nothing.
-- =====================================================================

alter table sales_orders add column if not exists client_request_id uuid;
create unique index if not exists idx_so_client_request
    on sales_orders(client_request_id) where client_request_id is not null;

-- p_lines is a JSON array of { product_id, qty, rate, serial_no }.
create or replace function fn_save_sales_order(
    p_request_id uuid,
    p_lab_id uuid,
    p_transaction_date text,
    p_delivery_date text,
    p_notes text,
    p_lines text
) returns uuid language plpgsql as $$
declare
    v_id  uuid;
    it    jsonb;
    n     int := 0;
begin
    if p_lab_id is null then raise exception 'Pick a lab'; end if;

    -- Already booked under this request id? Return it, unchanged.
    if p_request_id is not null then
        select id into v_id from sales_orders where client_request_id = p_request_id;
        if found then return v_id; end if;
    end if;

    insert into sales_orders (lab_id, transaction_date, delivery_date, notes, client_request_id)
    values (
        p_lab_id,
        coalesce(nullif(p_transaction_date, '')::date, current_date),
        nullif(p_delivery_date, '')::date,
        nullif(p_notes, ''),
        p_request_id
    )
    returning id into v_id;

    for it in select * from jsonb_array_elements(p_lines::jsonb) loop
        if coalesce(it->>'product_id', '') = '' then continue; end if;
        if coalesce((it->>'qty')::numeric, 0) <= 0 then continue; end if;
        insert into sales_order_items (sales_order_id, product_id, qty, rate, serial_no)
        values (
            v_id,
            (it->>'product_id')::uuid,
            (it->>'qty')::numeric,
            coalesce((it->>'rate')::numeric, 0),
            nullif(trim(it->>'serial_no'), '')
        );
        n := n + 1;
    end loop;

    if n = 0 then raise exception 'Add at least one line'; end if;
    return v_id;
end; $$;
