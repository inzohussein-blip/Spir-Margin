-- =====================================================================
-- Migration 0032 : Tax Category & Taxes and Charges Templates
--
-- Ported from ERPNext "Tax Category" and the Sales/Purchase "Taxes and
-- Charges Template" (+ rows). A reusable named set of tax lines (rate %)
-- that can be attached to a transaction to compute tax.
-- =====================================================================

do $$ begin
    create type tax_applies_to as enum ('selling','buying');
exception when duplicate_object then null; end $$;

create table if not exists tax_categories (
    id       uuid primary key default gen_random_uuid(),
    title    text not null unique,
    disabled boolean not null default false
);

create table if not exists tax_templates (
    id            uuid primary key default gen_random_uuid(),
    title         text not null unique,
    applies_to    tax_applies_to not null default 'selling',
    tax_category  text,
    is_default    boolean not null default false,
    disabled      boolean not null default false,
    created_at    timestamptz not null default now()
);

create table if not exists tax_template_rows (
    id           uuid primary key default gen_random_uuid(),
    template_id  uuid not null references tax_templates(id) on delete cascade,
    description  text not null,
    account_head text,
    rate         numeric(6,3) not null default 0,   -- percent
    created_at   timestamptz not null default now()
);

create index if not exists idx_taxrows_t on tax_template_rows(template_id);

-- compute the tax amount a template adds to a net amount
create or replace function fn_template_tax(p_template_id uuid, p_net numeric)
returns numeric language sql stable as $$
    select coalesce(sum(p_net * rate / 100), 0)
    from tax_template_rows where template_id = p_template_id;
$$;

insert into tax_categories (title) values ('Standard'), ('Exempt')
on conflict (title) do nothing;

do $$
declare v_id uuid;
begin
    if not exists (select 1 from tax_templates where title = 'VAT 0%') then
        insert into tax_templates (title, applies_to, tax_category, is_default) values ('VAT 0%', 'selling', 'Exempt', true) returning id into v_id;
        insert into tax_template_rows (template_id, description, rate) values (v_id, 'VAT', 0);
    end if;
end $$;

do $$
declare t text;
begin
    foreach t in array array['tax_categories','tax_templates','tax_template_rows']
    loop
        execute format('alter table %I enable row level security;', t);
        execute format('drop policy if exists "authenticated_all" on %I;', t);
        execute format($f$
            create policy "authenticated_all" on %I
                for all to authenticated using (true) with check (true);
        $f$, t);
    end loop;
end $$;
