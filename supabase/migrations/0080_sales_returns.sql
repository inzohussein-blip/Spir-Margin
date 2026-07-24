-- =====================================================================
-- Migration 0080 : Sales Returns (credit notes)
--
-- A lab can return kits/devices. A return is the mirror of a sale, so it is
-- booked additively — it never touches the original sale row:
--   * kit stock is put BACK (a new "returned goods" batch is created);
--   * a REVERSING journal entry is posted, the exact opposite of fn_post_sale_gl:
--         Dr Sales (income)        Cr Accounts Receivable   (revenue reversed)
--         Dr Stock In Hand         Cr Cost of Goods Sold    (cost back to stock)
--   * every change is captured by the immutable audit trail.
--
-- Booking is idempotent on a client_request_id (an offline/replayed submit can
-- never double-refund or double-restock). GL posting is DEFENSIVE — a chart-of-
-- accounts problem raises a warning, never breaks the return. The profit summary
-- is recreated to report figures NET of submitted returns.
-- =====================================================================

do $$ begin
    create type sales_return_status as enum ('submitted','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists sales_returns (
    id                uuid primary key default gen_random_uuid(),
    return_no         text unique,
    client_request_id uuid unique,                 -- idempotency for offline replays
    lab_id            uuid not null references labs(id) on delete restrict,
    posting_date      date not null default current_date,
    status            sales_return_status not null default 'submitted',
    reason            text,
    notes             text,
    total_amount      numeric(14,2) not null default 0,   -- synced from items
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_sret_lab on sales_returns(lab_id);
create index if not exists idx_sret_date on sales_returns(posting_date);

create table if not exists sales_return_items (
    id          uuid primary key default gen_random_uuid(),
    return_id   uuid not null references sales_returns(id) on delete cascade,
    product_id  uuid not null references products(id) on delete restrict,
    qty         numeric(14,2) not null check (qty > 0),
    buy_price   numeric(14,2) not null default 0,
    sell_price  numeric(14,2) not null default 0,
    amount      numeric(14,2) generated always as (qty * sell_price) stored,
    created_at  timestamptz not null default now()
);

create index if not exists idx_sretitems_ret on sales_return_items(return_id);

-- keep sales_returns.total_amount = sum of item amounts
create or replace function fn_sync_return_total() returns trigger
language plpgsql as $$
declare v_ret uuid;
begin
    v_ret := coalesce(new.return_id, old.return_id);
    update sales_returns set
        total_amount = coalesce((select sum(amount) from sales_return_items where return_id = v_ret), 0),
        updated_at = now()
    where id = v_ret;
    return null;
end $$;

drop trigger if exists trg_sync_return_total on sales_return_items;
create trigger trg_sync_return_total
    after insert or update or delete on sales_return_items
    for each row execute function fn_sync_return_total();

-- Reversing GL for a return — the exact opposite of fn_post_sale_gl.
create or replace function fn_post_return_gl(p_return_id uuid)
returns void language plpgsql as $$
declare
    v_lab uuid; v_date date; v_sell_amt numeric; v_cost_amt numeric;
    v_ar text; v_income text; v_cogs text; v_stock text;
    v_je uuid; v_lines int := 0;
begin
    select lab_id, posting_date into v_lab, v_date from sales_returns where id = p_return_id;
    if not found then return; end if;

    select coalesce(sum(qty * sell_price), 0), coalesce(sum(qty * buy_price), 0)
      into v_sell_amt, v_cost_amt
      from sales_return_items where return_id = p_return_id;
    v_sell_amt := round(v_sell_amt, 2);
    v_cost_amt := round(v_cost_amt, 2);

    select account_name into v_ar     from accounts where account_type = 'Receivable'         and not is_group and not disabled order by account_number limit 1;
    select account_name into v_income from accounts where root_type = 'income'                and not is_group and not disabled order by account_number limit 1;
    select account_name into v_cogs   from accounts where account_type = 'Cost of Goods Sold' and not is_group and not disabled order by account_number limit 1;
    select account_name into v_stock  from accounts where account_type = 'Stock'              and not is_group and not disabled order by account_number limit 1;

    insert into journal_entries (voucher_type, posting_date, user_remark)
      values ('Sales Invoice', coalesce(v_date, current_date), 'Auto GL for sales return ' || p_return_id)
      returning id into v_je;

    -- Revenue reversed: Dr Sales / Cr Accounts Receivable.
    if v_ar is not null and v_income is not null and v_sell_amt > 0 then
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit)
          values (v_je, v_income, v_sell_amt, 0);
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit, party_type, party_lab_id)
          values (v_je, v_ar, 0, v_sell_amt, 'lab', v_lab);
        v_lines := v_lines + 2;
    end if;
    -- Cost returned to stock: Dr Stock In Hand / Cr Cost of Goods Sold.
    if v_cogs is not null and v_stock is not null and v_cost_amt > 0 then
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_stock, v_cost_amt, 0);
        insert into journal_entry_accounts (journal_entry_id, account, debit, credit) values (v_je, v_cogs, 0, v_cost_amt);
        v_lines := v_lines + 2;
    end if;

    if v_lines = 0 then
        delete from journal_entries where id = v_je;
        return;
    end if;
    perform fn_post_journal_entry(v_je);
exception when others then
    raise warning 'Auto GL for sales return % skipped: %', p_return_id, sqlerrm;
    return;
end $$;

-- Book a return atomically and idempotently: header + items, restock kits,
-- post the reversing GL. Returns the return id (existing one on replay).
-- p_lines is a JSON array of { product_id, qty, sell_price }.
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

        -- Put kit stock back as a dedicated returned-goods batch.
        if v_type = 'kit' then
            insert into kit_batches (batch_no, product_id, qty_received, qty_available, buy_price, sell_price)
            values (v_no || '-' || substr(v_pid::text, 1, 4), v_pid, v_qty, v_qty, coalesce(v_buy, 0), v_sell);
        end if;
        n := n + 1;
    end loop;

    if n = 0 then raise exception 'Add at least one line'; end if;

    perform fn_post_return_gl(v_id);
    return v_id;
end $$;

-- Report profit/revenue/cost NET of submitted returns (a return reverses a sale).
create or replace view v_profit_summary as
with s as (
    select coalesce(sum(profit), 0) p, coalesce(sum(sell_price * qty), 0) rev,
           coalesce(sum(buy_price * qty), 0) cost, count(*) n
    from sales
), r as (
    select coalesce(sum(ri.sell_price * ri.qty), 0) rev,
           coalesce(sum(ri.buy_price * ri.qty), 0) cost
    from sales_return_items ri
    join sales_returns sr on sr.id = ri.return_id
    where sr.status = 'submitted'
)
select
    (s.p - (r.rev - r.cost))  as total_profit,
    (s.rev - r.rev)           as total_revenue,
    (s.cost - r.cost)         as total_cost,
    s.n                       as sales_count
from s, r;

-- Audit the returns like every other money document.
do $$
declare t text;
begin
    foreach t in array array['sales_returns','sales_return_items']
    loop
        if to_regclass('public.'||t) is not null then
            execute format('drop trigger if exists trg_audit on %I', t);
            execute format(
                'create trigger trg_audit after insert or update or delete on %I '
                'for each row execute function fn_audit()', t);
        end if;
    end loop;
end $$;

do $$
declare t text;
begin
    foreach t in array array['sales_returns','sales_return_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
