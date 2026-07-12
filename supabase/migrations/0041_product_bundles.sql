-- =====================================================================
-- Migration 0041 : Product Bundle (a kit sold as a set of items)
--
-- Ported (lightened) from ERPNext "Product Bundle" (+ item rows). Unlike a
-- BOM (which is assembled by a work order), a bundle is sold as one item and
-- delivered as its component parts — e.g. a reagent kit shipped with its
-- consumables. bundle_value is kept in sync with the component rows.
-- =====================================================================

create table if not exists product_bundles (
    id           uuid primary key default gen_random_uuid(),
    product_id   uuid not null references products(id) on delete restrict,
    description  text,
    is_active    boolean not null default true,
    bundle_value numeric(14,2) not null default 0,   -- synced from rows
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now(),
    unique (product_id)
);

create table if not exists product_bundle_items (
    id           uuid primary key default gen_random_uuid(),
    bundle_id    uuid not null references product_bundles(id) on delete cascade,
    component_id uuid not null references products(id) on delete restrict,
    qty          numeric(14,3) not null default 1,
    rate         numeric(14,2) not null default 0,
    uom          text,
    created_at   timestamptz not null default now()
);

create index if not exists idx_bundleitems_bundle on product_bundle_items(bundle_id);

-- keep product_bundles.bundle_value = sum(qty * rate) of its rows
create or replace function fn_sync_bundle_value() returns trigger
language plpgsql as $$
declare v_bundle uuid;
begin
    v_bundle := coalesce(new.bundle_id, old.bundle_id);
    update product_bundles set
        bundle_value = coalesce((select sum(qty * rate) from product_bundle_items where bundle_id = v_bundle), 0),
        updated_at = now()
    where id = v_bundle;
    return null;
end $$;

drop trigger if exists trg_sync_bundle_value on product_bundle_items;
create trigger trg_sync_bundle_value
    after insert or update or delete on product_bundle_items
    for each row execute function fn_sync_bundle_value();

do $$
declare t text;
begin
    foreach t in array array['product_bundles','product_bundle_items']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
