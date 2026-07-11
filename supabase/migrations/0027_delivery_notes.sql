-- =====================================================================
-- Migration 0027 : Cost Center & Delivery Note
--
-- Ported from ERPNext "Cost Center" (simple master) and "Delivery Note"
-- (+ item). Submitting a delivery note records a withdrawal per line, which
-- the existing stock-movement trigger uses to decrement the kit batch and
-- mark the lab active — closing the "selling reduces batch stock" gap.
-- =====================================================================

-- Cost Center ----------------------------------------------------------
create table if not exists cost_centers (
    id                 uuid primary key default gen_random_uuid(),
    name               text not null unique,
    cost_center_number text,
    parent_cost_center text,
    is_group           boolean not null default false,
    disabled           boolean not null default false
);

insert into cost_centers (name, is_group) values
    ('Main', true), ('Sales', false), ('Service', false), ('Administration', false)
on conflict (name) do nothing;

alter table journal_entry_accounts add column if not exists cost_center text;

-- Delivery Note --------------------------------------------------------
do $$ begin
    create type delivery_status as enum ('draft','delivered','cancelled');
exception when duplicate_object then null; end $$;

create table if not exists delivery_notes (
    id            uuid primary key default gen_random_uuid(),
    naming_series text,
    lab_id        uuid not null references labs(id) on delete restrict,
    posting_date  date not null default current_date,
    status        delivery_status not null default 'draft',
    notes         text,
    delivered_at  timestamptz,
    created_at    timestamptz not null default now()
);

create table if not exists delivery_note_items (
    id               uuid primary key default gen_random_uuid(),
    delivery_note_id uuid not null references delivery_notes(id) on delete cascade,
    kit_batch_id     uuid not null references kit_batches(id) on delete restrict,
    qty              numeric(14,2) not null check (qty > 0),
    created_at       timestamptz not null default now()
);

create index if not exists idx_dnitems_dn on delivery_note_items(delivery_note_id);

-- Submit: post a withdrawal per line (trigger decrements batch + activates lab)
create or replace function fn_submit_delivery_note(p_dn_id uuid)
returns int language plpgsql as $$
declare v_status delivery_status; v_lab uuid; it record; v_buy numeric; v_sell numeric; n int := 0;
begin
    select status, lab_id into v_status, v_lab from delivery_notes where id = p_dn_id;
    if not found then raise exception 'Delivery note not found'; end if;
    if v_status = 'delivered' then raise exception 'Already delivered'; end if;
    if v_status = 'cancelled' then raise exception 'Delivery note is cancelled'; end if;

    for it in select * from delivery_note_items where delivery_note_id = p_dn_id loop
        select buy_price, sell_price into v_buy, v_sell from kit_batches where id = it.kit_batch_id;
        insert into stock_movements (kit_batch_id, lab_id, type, qty, buy_price, sell_price, note)
        values (it.kit_batch_id, v_lab, 'withdrawal', it.qty, coalesce(v_buy,0), coalesce(v_sell,0),
                'Delivery note');
        n := n + 1;
    end loop;

    update delivery_notes set status = 'delivered', delivered_at = now() where id = p_dn_id;
    return n;
end; $$;

do $$
declare t text;
begin
    foreach t in array array['cost_centers','delivery_notes','delivery_note_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
