-- =====================================================================
-- Migration 0051 : Pricing Rule (lab / quantity discounts)
--
-- Ported (lightened) from ERPNext "Pricing Rule". A percentage discount that
-- applies when its conditions match — optionally scoped to a product, a lab,
-- a quantity band, and a validity window. fn_best_discount returns the best
-- matching discount % for a (product, lab, qty).
-- =====================================================================

create table if not exists pricing_rules (
    id                  uuid primary key default gen_random_uuid(),
    title               text not null,
    disabled            boolean not null default false,
    product_id          uuid references products(id) on delete cascade,   -- null = any product
    lab_id              uuid references labs(id) on delete cascade,        -- null = any lab
    min_qty             numeric(14,2) not null default 0,
    max_qty             numeric(14,2),
    discount_percentage numeric(6,2) not null default 0,
    valid_from          date,
    valid_upto          date,
    priority            integer not null default 0,
    created_at          timestamptz not null default now()
);

create index if not exists idx_pricingrules_product on pricing_rules(product_id);
create index if not exists idx_pricingrules_lab on pricing_rules(lab_id);

-- best matching discount % for a product/lab/qty at today's date
create or replace function fn_best_discount(p_product_id uuid, p_lab_id uuid, p_qty numeric)
returns numeric language sql stable as $$
    select coalesce(max(discount_percentage), 0)
    from pricing_rules
    where not disabled
      and (product_id is null or product_id = p_product_id)
      and (lab_id is null or lab_id = p_lab_id)
      and p_qty >= min_qty
      and (max_qty is null or p_qty <= max_qty)
      and (valid_from is null or valid_from <= current_date)
      and (valid_upto is null or valid_upto >= current_date);
$$;

do $$ begin
    execute 'alter table pricing_rules enable row level security';
    execute 'drop policy if exists "authenticated_all" on pricing_rules';
    execute 'create policy "authenticated_all" on pricing_rules for all to authenticated using (true) with check (true)';
end $$;
