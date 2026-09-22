-- =====================================================================
-- Migration 0096 : Sales requests and transport authorisations
--
-- Two documents the company issues by hand today.
--
-- A SALES REQUEST is what a customer asks for before anything is invoiced:
-- lines, a total, and a receipt to hand over. It is deliberately looser than
-- a sales order — a line may name a product from the catalogue or just
-- describe one, because the person writing it is often on the phone.
--
-- A TRANSPORT AUTHORISATION is a formal letter: it names who is authorised
-- to move which equipment between which governorates, in which vehicle, and
-- until when. It is carried and shown, so what matters is that it prints as
-- a proper letter on the company's letterhead.
--
-- Both are business records, so unlike the branding they are NOT `_spir`
-- prefixed and they sync like everything else.
-- =====================================================================

-- ── Sales requests ──────────────────────────────────────────────────
create table if not exists sale_requests (
    id            uuid primary key default gen_random_uuid(),
    request_no    text not null unique,
    request_date  date not null default current_date,
    lab_id        uuid references labs(id) on delete set null,
    customer_name text,                      -- when the buyer is not a lab
    customer_phone text,
    status        text not null default 'draft'
                  check (status in ('draft', 'confirmed', 'delivered', 'cancelled')),
    currency      text not null default 'USD',
    discount      numeric(14, 2) not null default 0 check (discount >= 0),
    notes         text,
    created_by    text,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);
create index if not exists idx_sale_requests_lab on sale_requests(lab_id);
create index if not exists idx_sale_requests_date on sale_requests(request_date desc);

create table if not exists sale_request_items (
    id          uuid primary key default gen_random_uuid(),
    request_id  uuid not null references sale_requests(id) on delete cascade,
    product_id  uuid references products(id) on delete set null,
    description text not null,               -- always set, even for a catalogue line
    qty         numeric(14, 3) not null default 1 check (qty > 0),
    rate        numeric(14, 2) not null default 0 check (rate >= 0),
    line_no     int not null default 1,
    amount      numeric(14, 2) generated always as (round(qty * rate, 2)) stored
);
create index if not exists idx_sale_request_items_request on sale_request_items(request_id);
create index if not exists idx_sale_request_items_product on sale_request_items(product_id);

/** What the request comes to, after its discount. */
create or replace function fn_sale_request_total(p_request uuid) returns numeric
language sql stable as $$
    select greatest(
        coalesce((select sum(amount) from sale_request_items where request_id = p_request), 0)
        - coalesce((select discount from sale_requests where id = p_request), 0),
        0)
$$;

create or replace view v_sale_request_totals as
    select r.id,
           coalesce(sum(i.amount), 0)                        as subtotal,
           r.discount,
           greatest(coalesce(sum(i.amount), 0) - r.discount, 0) as total,
           count(i.id)                                       as line_count
      from sale_requests r
      left join sale_request_items i on i.request_id = r.id
     group by r.id, r.discount;

-- ── Transport authorisations ────────────────────────────────────────
create table if not exists transport_authorizations (
    id             uuid primary key default gen_random_uuid(),
    auth_no        text not null unique,
    issue_date     date not null default current_date,
    valid_from     date not null default current_date,
    valid_to       date not null,
    addressed_to   text,                      -- the checkpoint or authority
    bearer_name    text not null,             -- the person carrying this
    bearer_id_no   text,
    bearer_phone   text,
    driver_name    text,
    vehicle_type   text,
    vehicle_plate  text,
    from_governorate text not null,
    to_governorate   text not null,
    destination    text,                      -- the lab or hospital
    purpose        text,
    notes          text,
    status         text not null default 'issued'
                   check (status in ('issued', 'expired', 'cancelled')),
    created_by     text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now(),
    constraint transport_auth_dates check (valid_to >= valid_from)
);
create index if not exists idx_transport_auth_date on transport_authorizations(issue_date desc);

create table if not exists transport_authorization_items (
    id          uuid primary key default gen_random_uuid(),
    auth_id     uuid not null references transport_authorizations(id) on delete cascade,
    device_id   uuid references devices(id) on delete set null,
    description text not null,
    qty         numeric(14, 3) not null default 1 check (qty > 0),
    unit        text,
    serial_no   text,
    notes       text,
    line_no     int not null default 1
);
create index if not exists idx_transport_auth_items_auth on transport_authorization_items(auth_id);
create index if not exists idx_transport_auth_items_device on transport_authorization_items(device_id);

-- Same access rule as the rest of the app's tables.
do $$
declare tbl text;
begin
    foreach tbl in array array['sale_requests', 'sale_request_items',
                               'transport_authorizations', 'transport_authorization_items']
    loop
        execute format('alter table %I enable row level security', tbl);
        execute format('drop policy if exists "authenticated_all" on %I', tbl);
        execute format('create policy "authenticated_all" on %I for all to authenticated using (true) with check (true)', tbl);
    end loop;
end $$;

-- These tables were created after 0089, which is what attaches the change-log
-- triggers, so they need it applied again. Any migration that adds a table
-- ends this way — the app re-attaches on boot, but a database stood up with
-- `psql -f schema.sql` never calls that, and would sync nothing from these.
select _spir_attach_change_log();
