-- =====================================================================
-- Migration 0073 : Idempotent POS checkout (offline-safe sales)
--
-- When the network drops, the browser queues sales in a local outbox and
-- replays them when it comes back. A replay must NEVER double-post a sale
-- (that would be a real money error), so each checkout carries a client-
-- generated request id and is booked exactly once.
--
-- fn_pos_checkout runs as a single transaction and is idempotent on the
-- request id: the first call books the sale and remembers its result; any
-- later call with the same id just returns that stored result and changes
-- nothing. It keeps every money-integrity rule of the old code path — the
-- customer must exist, products must exist and be enabled, and the COST is
-- always re-read from the product (never trusted from the client).
-- =====================================================================

create table if not exists idempotency_keys (
    key        uuid primary key,
    result     jsonb not null,
    created_at timestamptz not null default now()
);

alter table idempotency_keys enable row level security;
drop policy if exists "authenticated_all" on idempotency_keys;
create policy "authenticated_all" on idempotency_keys for all to authenticated using (true) with check (true);

-- p_lines is a JSON array of { product_id, qty, sell_price }.
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

    -- Already processed? Return the stored result and do nothing else.
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

        -- Authoritative cost — never taken from the client.
        select default_buy_price, is_disabled into v_buy, v_disabled from products where id = v_pid;
        if not found then raise exception 'A product in the cart no longer exists.'; end if;
        if v_disabled then raise exception 'A product in the cart is disabled.'; end if;

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
